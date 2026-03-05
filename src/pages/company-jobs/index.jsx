import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import UserContextNavigation from '../../components/ui/UserContextNavigation';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import LoadingIndicator from '../../components/ui/LoadingIndicator';
import LoadingState from '../../components/ui/LoadingState';
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
import { useRealtimePathFeed } from '../../hooks/useRealtimePathFeed';
import { hasPermission } from '../../utils/rolePermissions';
import { cn } from '../../utils/cn';
import { buildJobShareCardUrl, buildJobSharePackage, prepareJobShareAttachments } from '../../utils/jobShare.js';
import { ORGANIZATION_FEED_EVENTS } from '../../constants/realtimeFeedEvents.js';
import ApplicationFormBuilder from '../../components/ui/ApplicationFormBuilder';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const MAX_ADVERT_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_ADVERT_VIDEO_BYTES = 50 * 1024 * 1024;
const ADVERT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ADVERT_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
const PRESET_JOB_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Python',
  'Java',
  'SQL',
  'AWS',
  'Docker',
  'Kubernetes',
  'Git',
  'Testing/QA',
  'Other',
];
const REQUIREMENTS_BULLET = '• ';

const COMPANY_JOB_DATE_PRESET_OPTIONS = [
  { value: 'all', label: 'All Dates' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'last90', label: 'Last 90 Days' },
  { value: 'custom', label: 'Custom Range' },
];

const COMPANY_JOB_LOCATION_MODE_OPTIONS = [
  { value: 'all', label: 'All Location Modes' },
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
];

const COMPANY_JOB_APPLICATION_STATE_OPTIONS = [
  { value: 'all', label: 'All Application Volumes' },
  { value: 'with-applications', label: 'With Applications' },
  { value: 'without-applications', label: 'Without Applications' },
];

const COMPANY_JOB_PUBLISH_STATE_OPTIONS = [
  { value: 'all', label: 'All Publish States' },
  { value: 'scheduled', label: 'Scheduled Publish' },
  { value: 'live', label: 'Published (Live)' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

const COMPANY_JOB_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'applicationsDesc', label: 'Most Applications' },
  { value: 'titleAsc', label: 'Role Name (A-Z)' },
  { value: 'status', label: 'Status (A-Z)' },
];

const DEFAULT_COMPANY_JOB_FILTERS = {
  searchQuery: '',
  status: 'all',
  employmentType: 'all',
  experienceLevel: 'all',
  department: 'all',
  locationMode: 'all',
  applicationState: 'all',
  publishState: 'all',
  datePreset: 'all',
  from: '',
  to: '',
  sortBy: 'newest',
};

const normalizeFilterValue = (value) => (value || '').toString().trim().toLowerCase();

const getCompanyJobDateWindow = (filters = {}) => {
  const preset = normalizeFilterValue(filters.datePreset || 'all');
  if (preset === 'all') return { from: null, to: null };

  if (preset === 'custom') {
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;
    if (from && !Number.isNaN(from.getTime())) from.setHours(0, 0, 0, 0);
    if (to && !Number.isNaN(to.getTime())) to.setHours(23, 59, 59, 999);
    return {
      from: from && !Number.isNaN(from.getTime()) ? from : null,
      to: to && !Number.isNaN(to.getTime()) ? to : null,
    };
  }

  const now = new Date();
  const from = new Date(now);
  if (preset === 'last7') from.setDate(from.getDate() - 7);
  if (preset === 'last30') from.setDate(from.getDate() - 30);
  if (preset === 'last90') from.setDate(from.getDate() - 90);
  from.setHours(0, 0, 0, 0);
  return { from, to: null };
};

const getCompanyJobLocationMode = (location) => {
  const normalized = normalizeFilterValue(location);
  if (!normalized || normalized === 'remote' || normalized.includes('remote')) return 'remote';
  if (normalized.includes('hybrid')) return 'hybrid';
  return 'onsite';
};

const getCompanyJobPublishState = (job = {}) => {
  const status = (job?.status || '').toString().toUpperCase();
  if (status === 'ARCHIVED') return 'archived';
  if (status === 'DRAFT') return 'draft';
  if (status === 'PUBLISHED' && job?.scheduledPublishAt && !job?.publishedAt) return 'scheduled';
  if (status === 'PUBLISHED') return 'live';
  return 'all';
};

const countActiveCompanyJobFilters = (filters = {}) => {
  let count = 0;
  if (normalizeFilterValue(filters.searchQuery)) count += 1;
  if ((filters.status || 'all') !== 'all') count += 1;
  if ((filters.employmentType || 'all') !== 'all') count += 1;
  if ((filters.experienceLevel || 'all') !== 'all') count += 1;
  if ((filters.department || 'all') !== 'all') count += 1;
  if ((filters.locationMode || 'all') !== 'all') count += 1;
  if ((filters.applicationState || 'all') !== 'all') count += 1;
  if ((filters.publishState || 'all') !== 'all') count += 1;
  if ((filters.datePreset || 'all') !== 'all') count += 1;
  if ((filters.sortBy || 'newest') !== 'newest') count += 1;
  return count;
};

const normalizeSkillValue = (value = '') => value.trim().toLowerCase();

const mergeUniqueSkills = (existingSkills = [], incomingSkills = []) => {
  const seen = new Set(existingSkills.map((skill) => normalizeSkillValue(skill)));
  const merged = [...existingSkills];

  incomingSkills.forEach((rawSkill) => {
    const skill = rawSkill?.trim();
    if (!skill) return;
    const normalized = normalizeSkillValue(skill);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    merged.push(skill);
  });

  return merged;
};

const parseRequirementsToList = (value) => {
  if (!value) return [];
  const rawLines = Array.isArray(value)
    ? value
    : value.toString().split(/\r?\n/);

  return rawLines
    .map((line) => (line == null ? '' : String(line)))
    .map((line) => line.replace(/^\s*(?:[-*•]\s*|\d+[.)]\s*)/, '').trim())
    .filter(Boolean);
};

const toRequirementsInputValue = (value) => {
  const lines = parseRequirementsToList(value);
  if (!lines.length) return '';
  return lines.map((line) => `${REQUIREMENTS_BULLET}${line}`).join('\n');
};

const normalizeRequirementsInputValue = (value) => {
  const lines = parseRequirementsToList(value);
  if (!lines.length) return '';
  return lines.map((line) => `${REQUIREMENTS_BULLET}${line}`).join('\n');
};

const mapCustomFieldTypeToQuestionType = (fieldType) => {
  const normalized = (fieldType || '').toString().trim().toLowerCase();
  if (normalized === 'select') return 'SELECT';
  if (normalized === 'textarea') return 'TEXTAREA';
  if (normalized === 'checkbox') return 'CHECKBOX';
  if (normalized === 'number') return 'NUMBER';
  if (normalized === 'date') return 'DATE';
  if (normalized === 'url') return 'URL';
  if (normalized === 'file') return 'FILE';
  return 'TEXT';
};

const mapQuestionTypeToCustomFieldType = (questionType) => {
  const normalized = (questionType || '').toString().trim().toUpperCase();
  if (normalized === 'SELECT') return 'select';
  if (normalized === 'TEXTAREA') return 'textarea';
  if (normalized === 'CHECKBOX') return 'checkbox';
  if (normalized === 'NUMBER') return 'number';
  if (normalized === 'DATE') return 'date';
  if (normalized === 'URL') return 'url';
  if (normalized === 'FILE') return 'file';
  return 'text';
};

const normalizeCustomFormFields = (fields = []) =>
  (Array.isArray(fields) ? fields : [])
    .map((rawField, index) => {
      const field = rawField && typeof rawField === 'object'
        ? rawField
        : { label: rawField };
      const id = (field.id || `field_${index + 1}`).toString().trim() || `field_${index + 1}`;
      const label = (field.label || field.question || '').toString().trim();
      return {
        id,
        label,
        type: mapQuestionTypeToCustomFieldType(field.type),
        required: Boolean(field.required),
        options: Array.isArray(field.options)
          ? field.options
            .map((option) => (option || '').toString().trim())
            .filter(Boolean)
          : [],
        placeholder: (field.placeholder || '').toString().trim(),
      };
    })
    .filter((field) => field.label);

const buildApplicationQuestionsFromCustomFields = (fields = []) =>
  normalizeCustomFormFields(fields).map((field) => ({
    id: field.id,
    question: field.label,
    type: mapCustomFieldTypeToQuestionType(field.type),
    required: field.required,
    options: field.type === 'select' ? field.options : [],
    placeholder: field.placeholder || null,
  }));

const buildCustomFieldsFromApplicationQuestions = (questions = []) =>
  (Array.isArray(questions) ? questions : [])
    .map((rawQuestion, index) => {
      const question = rawQuestion && typeof rawQuestion === 'object'
        ? rawQuestion
        : { question: rawQuestion };
      const id = (question.id || `field_${index + 1}`).toString().trim() || `field_${index + 1}`;
      const label = (question.question || question.label || '').toString().trim();
      return {
        id,
        label,
        type: mapQuestionTypeToCustomFieldType(question.type),
        required: Boolean(question.required),
        options: Array.isArray(question.options)
          ? question.options
            .map((option) => (option || '').toString().trim())
            .filter(Boolean)
          : [],
        placeholder: (question.placeholder || '').toString().trim(),
      };
    })
    .filter((field) => field.label);

const normalizeAdvertImageUrls = (job = {}) => {
  if (Array.isArray(job?.advertImageUrls)) {
    return job.advertImageUrls
      .map((url) => (typeof url === 'string' ? url.trim() : ''))
      .filter(Boolean);
  }
  if (typeof job?.advertImageUrl === 'string' && job.advertImageUrl.trim()) {
    return [job.advertImageUrl.trim()];
  }
  return [];
};

const toAbsoluteAssetUrl = (value) => {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }
  const base = API_URL.replace(/\/$/, '');
  return `${base}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`;
};

const toDateTimeLocalValue = (isoValue) => {
  if (!isoValue || typeof isoValue !== 'string') return '';
  const parsed = new Date(isoValue);
  if (Number.isNaN(parsed.getTime())) return '';
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
};

const formatDateTime = (value) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleString();
};

const isResizeHandleClick = (event) => {
  if (!event?.currentTarget?.getBoundingClientRect) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  const resizeHandleZone = 22;
  const nearRight = rect.right - event.clientX <= resizeHandleZone;
  const nearBottom = rect.bottom - event.clientY <= resizeHandleZone;
  return nearRight && nearBottom;
};

const SCHEDULE_WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const parseLocalDateTimeValue = (value) => {
  if (!value || typeof value !== 'string') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatLocalDateTimeValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const areSameCalendarDate = (left, right) => (
  left?.getFullYear?.() === right?.getFullYear?.()
  && left?.getMonth?.() === right?.getMonth?.()
  && left?.getDate?.() === right?.getDate?.()
);

const buildCalendarGridDays = (monthDate) => {
  const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const firstGridDate = new Date(monthStart);
  firstGridDate.setDate(monthStart.getDate() - monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(firstGridDate);
    day.setDate(firstGridDate.getDate() + index);
    return day;
  });
};

const isDateBeforeMinimumDay = (date, minDate) => {
  if (!minDate) return false;
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
  return endOfDay.getTime() < minDate.getTime();
};

const clampToMinDate = (date, minDate) => {
  if (!date) return null;
  if (!minDate) return date;
  return date.getTime() < minDate.getTime() ? new Date(minDate) : date;
};

const ScheduleDateTimePicker = ({ value, minValue, timezoneLabel, onChange, required = false }) => {
  const selectedDate = parseLocalDateTimeValue(value);
  const minDate = parseLocalDateTimeValue(minValue);
  const fallbackDate = minDate || new Date();
  const activeDate = selectedDate || fallbackDate;
  const [visibleMonth, setVisibleMonth] = useState(
    new Date(activeDate.getFullYear(), activeDate.getMonth(), 1),
  );

  useEffect(() => {
    const anchorDate = parseLocalDateTimeValue(value) || parseLocalDateTimeValue(minValue) || new Date();
    setVisibleMonth((previousMonth) => {
      if (
        previousMonth.getFullYear() === anchorDate.getFullYear()
        && previousMonth.getMonth() === anchorDate.getMonth()
      ) {
        return previousMonth;
      }
      return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    });
  }, [value, minValue]);

  const hour24 = activeDate.getHours();
  const selectedHour = String(((hour24 + 11) % 12) + 1).padStart(2, '0');
  const selectedMinute = String(activeDate.getMinutes()).padStart(2, '0');
  const selectedPeriod = hour24 >= 12 ? 'PM' : 'AM';
  const [hourInput, setHourInput] = useState(selectedHour);
  const [minuteInput, setMinuteInput] = useState(selectedMinute);
  const calendarDays = buildCalendarGridDays(visibleMonth);
  const selectedDateLabel = selectedDate
    ? selectedDate.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' })
    : 'Select a date and time';
  const monthLabel = visibleMonth.toLocaleString([], { month: 'long', year: 'numeric' });

  const emitDateChange = (candidateDate) => {
    const clampedDate = clampToMinDate(candidateDate, minDate);
    if (!clampedDate) return;
    onChange?.(formatLocalDateTimeValue(clampedDate));
  };

  const handleDaySelect = (dayDate) => {
    if (isDateBeforeMinimumDay(dayDate, minDate)) return;
    const next = new Date(activeDate);
    next.setFullYear(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate());
    next.setSeconds(0, 0);
    emitDateChange(next);
  };

  const applyTimeChange = ({ nextHour = selectedHour, nextMinute = selectedMinute, nextPeriod = selectedPeriod }) => {
    const hour = Number(nextHour);
    const minute = Number(nextMinute);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return;

    const next = new Date(activeDate);
    let convertedHour = hour % 12;
    if (nextPeriod === 'PM') {
      convertedHour += 12;
    }
    next.setHours(convertedHour, minute, 0, 0);
    emitDateChange(next);
  };

  useEffect(() => {
    setHourInput(selectedHour);
  }, [selectedHour]);

  useEffect(() => {
    setMinuteInput(selectedMinute);
  }, [selectedMinute]);

  const commitHourInput = () => {
    const sanitized = hourInput.replace(/\D/g, '');
    if (!sanitized) {
      setHourInput(selectedHour);
      return;
    }
    const parsedHour = Number.parseInt(sanitized, 10);
    if (!Number.isInteger(parsedHour)) {
      setHourInput(selectedHour);
      return;
    }
    const clampedHour = Math.min(12, Math.max(1, parsedHour));
    const normalizedHour = String(clampedHour).padStart(2, '0');
    setHourInput(normalizedHour);
    applyTimeChange({ nextHour: normalizedHour });
  };

  const commitMinuteInput = () => {
    const sanitized = minuteInput.replace(/\D/g, '');
    if (!sanitized) {
      setMinuteInput(selectedMinute);
      return;
    }
    const parsedMinute = Number.parseInt(sanitized, 10);
    if (!Number.isInteger(parsedMinute)) {
      setMinuteInput(selectedMinute);
      return;
    }
    const clampedMinute = Math.min(59, Math.max(0, parsedMinute));
    const normalizedMinute = String(clampedMinute).padStart(2, '0');
    setMinuteInput(normalizedMinute);
    applyTimeChange({ nextMinute: normalizedMinute });
  };

  const applyRelativeMinutesPreset = (minutesToAdd) => {
    const quickDate = new Date();
    quickDate.setMinutes(quickDate.getMinutes() + minutesToAdd, 0, 0);
    emitDateChange(quickDate);
  };

  const applyTomorrowAtPreset = (hours, minutes = 0) => {
    const quickDate = new Date();
    quickDate.setDate(quickDate.getDate() + 1);
    quickDate.setHours(hours, minutes, 0, 0);
    emitDateChange(quickDate);
  };

  const applyNextWeekdayAtPreset = (targetWeekday, hours, minutes = 0) => {
    const quickDate = new Date();
    const currentWeekday = quickDate.getDay();
    let daysToAdd = (targetWeekday - currentWeekday + 7) % 7;
    if (daysToAdd === 0) {
      daysToAdd = 7;
    }
    quickDate.setDate(quickDate.getDate() + daysToAdd);
    quickDate.setHours(hours, minutes, 0, 0);
    emitDateChange(quickDate);
  };

  const shortPresetOptions = [
    { label: '+15 min', onClick: () => applyRelativeMinutesPreset(15) },
    { label: '+30 min', onClick: () => applyRelativeMinutesPreset(30) },
    { label: '+1 hour', onClick: () => applyRelativeMinutesPreset(60) },
    { label: '+2 hours', onClick: () => applyRelativeMinutesPreset(120) },
  ];

  const longPresetOptions = [
    { label: 'Tomorrow 9:00 AM', onClick: () => applyTomorrowAtPreset(9, 0) },
    { label: 'Next Monday 9:00 AM', onClick: () => applyNextWeekdayAtPreset(1, 9, 0) },
  ];

  const baseTimeInputClass = 'h-11 w-full rounded-xl border border-input bg-background dark:bg-slate-900 px-3 text-center text-sm font-semibold text-foreground dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-all duration-200';

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
          Scheduled Publish Date & Time
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs text-gray-600 dark:text-slate-300">
          <Icon name="Globe2" size={12} />
          {timezoneLabel}
        </span>
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 px-3 py-2.5">
        <div className="inline-flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-200">
          <Icon name="CalendarClock" size={16} />
          {selectedDateLabel}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              className="h-8 w-8 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Previous month"
            >
              <Icon name="ChevronLeft" size={16} className="mx-auto" />
            </button>
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              {monthLabel}
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              className="h-8 w-8 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Next month"
            >
              <Icon name="ChevronRight" size={16} className="mx-auto" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {SCHEDULE_WEEKDAY_LABELS.map((weekday) => (
              <div
                key={weekday}
                className="text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 py-1"
              >
                {weekday}
              </div>
            ))}
            {calendarDays.map((dayDate) => {
              const isCurrentMonth = dayDate.getMonth() === visibleMonth.getMonth();
              const isSelected = selectedDate ? areSameCalendarDate(dayDate, selectedDate) : false;
              const isToday = areSameCalendarDate(dayDate, new Date());
              const isDisabled = isDateBeforeMinimumDay(dayDate, minDate);

              return (
                <button
                  key={dayDate.toISOString()}
                  type="button"
                  onClick={() => handleDaySelect(dayDate)}
                  disabled={isDisabled}
                  className={cn(
                    'h-9 w-9 rounded-lg text-sm font-medium transition-colors',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                      : isDisabled
                        ? 'cursor-not-allowed text-gray-300 dark:text-slate-600'
                        : isCurrentMonth
                          ? 'text-gray-800 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-500/20'
                          : 'text-gray-400 dark:text-slate-500 hover:bg-gray-100 dark:hover:bg-slate-800',
                    isToday && !isSelected && !isDisabled && 'ring-1 ring-blue-400/70 dark:ring-blue-500/60',
                  )}
                >
                  {dayDate.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-slate-100">
            <Icon name="Clock3" size={16} />
            Time
          </div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <input
              value={hourInput}
              onChange={(event) => setHourInput(event.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={commitHourInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitHourInput();
                  event.currentTarget.blur();
                }
              }}
              className={baseTimeInputClass}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="HH"
              aria-label="Hour"
            />
            <input
              value={minuteInput}
              onChange={(event) => setMinuteInput(event.target.value.replace(/\D/g, '').slice(0, 2))}
              onBlur={commitMinuteInput}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitMinuteInput();
                  event.currentTarget.blur();
                }
              }}
              className={baseTimeInputClass}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="MM"
              aria-label="Minute"
            />
            <Select
              value={selectedPeriod}
              onChange={(value) => applyTimeChange({ nextPeriod: value })}
              options={[
                { value: 'AM', label: 'AM' },
                { value: 'PM', label: 'PM' },
              ]}
              className="!space-y-0"
            />
          </div>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {shortPresetOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={option.onClick}
                  className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 text-xs font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {longPresetOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={option.onClick}
                  className="h-9 rounded-lg border border-gray-200 dark:border-slate-700 px-3 text-xs font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Select the publish date and time in your local timezone.
          </p>
        </div>
      </div>
    </div>
  );
};

const CompanyJobsPage = () => {
  const { user, logout, organizationContext, refresh } = useAuth();
  const navigate = useNavigate();
  const organizationId = organizationContext?.organization?.id || user?.organizationContext?.organization?.id;
  
  // Get organization role for permission checks
  const organizationRole = user?.organizationContext?.membership?.role;
  const canCreateJobs = hasPermission(organizationRole, 'CREATE_JOBS');
  const canEditJobs = hasPermission(organizationRole, 'EDIT_JOBS');
  const canDeleteJobs = hasPermission(organizationRole, 'DELETE_JOBS');

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobFilters, setJobFilters] = useState(DEFAULT_COMPANY_JOB_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const keySkillsInputRef = useRef(null);
  const shareFeedbackTimeoutRef = useRef(null);
  const [showAddSkillsSection, setShowAddSkillsSection] = useState(false);
  const advertImageInputRef = useRef(null);
  const advertVideoInputRef = useRef(null);
  const advertImageUploadsRef = useRef([]);
  const [advertImageUploads, setAdvertImageUploads] = useState([]);
  const [advertVideoFile, setAdvertVideoFile] = useState(null);
  const [advertVideoPreview, setAdvertVideoPreview] = useState('');
  
  // Location detection state
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationFeedback, setLocationFeedback] = useState({ status: 'idle', message: '' });

  // Local testing currently supports only Sri Lankan Rupees.
  const currencyOptions = [
    { value: 'LKR', label: 'LKR (Rs)', symbol: 'Rs', locale: 'si-LK' },
  ];

  // Format salary based on currency
  const formatSalary = (value, currency = 'LKR') => {
    if (!value) return '';
    // Remove all non-digit characters
    const numericValue = value.replace(/[^0-9]/g, '');
    if (!numericValue) return '';
    
    const currencyConfig = currencyOptions.find(c => c.value === currency) || currencyOptions[0];
    
    try {
      const number = parseInt(numericValue, 10);
      return new Intl.NumberFormat(currencyConfig.locale, {
        style: 'decimal',
        maximumFractionDigits: 0,
      }).format(number);
    } catch {
      return numericValue;
    }
  };

  // Parse formatted salary to raw number string
  const parseSalary = (formattedValue) => {
    if (!formattedValue) return '';
    return formattedValue.replace(/[^0-9]/g, '');
  };

  // Format detected location from geocoding API response
  const formatDetectedLocation = (data, coords) => {
    if (!data && !coords) {
      return '';
    }

    const administrative = data?.localityInfo?.administrative || [];
    const locality = data?.city
      || data?.locality
      || data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) >= 4)?.name;

    const region = data?.principalSubdivision
      || administrative.find((item) => (item.order ?? 0) <= 3)?.name;

    const country = data?.countryName || data?.countryCode;

    const parts = [locality, region, country].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(', ');
    }

    if (coords) {
      const { latitude, longitude } = coords;
      return `Lat ${latitude.toFixed(3)}, Long ${longitude.toFixed(3)}`;
    }

    return '';
  };

  // Handle location detection
  const handleDetectLocation = async () => {
    if (isDetectingLocation) {
      return;
    }

    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setLocationFeedback({
        status: 'error',
        message: 'Your browser does not support location detection. Please enter it manually.',
      });
      return;
    }

    setIsDetectingLocation(true);
    setLocationFeedback({
      status: 'info',
      message: 'Requesting location permission...',
    });

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      setLocationFeedback({
        status: 'info',
        message: 'Detecting your city...',
      });

      const { latitude, longitude } = position.coords || {};

      if (latitude == null || longitude == null) {
        throw new Error('We could not read your coordinates. Please enter your location manually.');
      }

      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
      );

      if (!response.ok) {
        throw new Error('Unable to determine your location automatically.');
      }

      const data = await response.json();
      const formattedLocation = formatDetectedLocation(data, { latitude, longitude });

      if (!formattedLocation) {
        throw new Error('We couldn\'t convert your coordinates into a city. Please enter it manually.');
      }

      setFormData(prev => ({ ...prev, location: formattedLocation }));

      // Clear location feedback on success
      setLocationFeedback({ status: 'success', message: '' });
    } catch (error) {
      let friendlyMessage = error?.message || 'Unable to detect your location. Please enter it manually.';

      if (error?.code === 1 || error?.message?.toLowerCase().includes('permission')) {
        friendlyMessage = 'Location permission was denied. You can enable it in your browser or enter the location manually.';
      } else if (error?.code === 2) {
        friendlyMessage = 'We could not determine your position. Please try again or enter it manually.';
      } else if (error?.code === 3) {
        friendlyMessage = 'Location request timed out. Please try again or enter it manually.';
      }

      setLocationFeedback({
        status: 'error',
        message: friendlyMessage,
      });
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    department: '',
    location: '',
    employmentType: 'FULL_TIME',
    experienceLevel: 'MID',
    description: '',
    requirements: '',
    benefits: '',
    salaryRange: '',
    salaryCurrency: 'LKR',
    salaryMin: '',
    salaryMax: '',
    postingDuration: '30',
    publishTiming: 'immediate',
    scheduledPublishAt: '',
    advertImageUrls: [],
    advertImageUrl: '',
    advertImageAlt: '',
    advertVideoUrl: '',
    status: 'DRAFT',
    requiredSkills: [],
    templateConfig: {
      interviewTypes: [],
      skillFocus: [],
      duration: 30,
    },
    customFormFields: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shareFeedback, setShareFeedback] = useState({ message: '', tone: 'success' });
  const [refreshing, setRefreshing] = useState(false);
  const [pendingRealtimeJobUpdates, setPendingRealtimeJobUpdates] = useState(0);

  useEffect(() => {
    document.title = 'Jobs - InterviewAI Pro';
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const result = await apiClient.jobs.getOrganizationJobs();
      if (result.success) {
        setJobs(result.jobs || []);
        setPendingRealtimeJobUpdates(0);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useRealtimePathFeed({
    path: organizationId ? `organizationFeeds/${organizationId}` : null,
    enabled: Boolean(organizationId),
    eventTypes: ORGANIZATION_FEED_EVENTS.jobs,
    onFeedUpdate: (_feed, { initial }) => {
      if (initial) return;
      // Non-disruptive list behavior: queue updates and let the recruiter refresh on demand.
      setPendingRealtimeJobUpdates((prev) => Math.min(prev + 1, 99));
    },
  });

  useEffect(() => {
    advertImageUploadsRef.current = advertImageUploads;
  }, [advertImageUploads]);

  useEffect(
    () => () => {
      advertImageUploadsRef.current.forEach((upload) => {
        if (upload?.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
      if (shareFeedbackTimeoutRef.current) {
        clearTimeout(shareFeedbackTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!advertVideoFile) {
      setAdvertVideoPreview('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(advertVideoFile);
    setAdvertVideoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [advertVideoFile]);

  const resetAdvertMediaState = () => {
    advertImageUploadsRef.current.forEach((upload) => {
      if (upload?.previewUrl) {
        URL.revokeObjectURL(upload.previewUrl);
      }
    });
    setAdvertImageUploads([]);
    setAdvertVideoFile(null);
    if (advertImageInputRef.current) {
      advertImageInputRef.current.value = '';
    }
    if (advertVideoInputRef.current) {
      advertVideoInputRef.current.value = '';
    }
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setSelectedJob(null);
    setShowAddSkillsSection(false);
    resetAdvertMediaState();
    setError('');
  };

  const handleRequirementsFocus = () => {
    setFormData((previous) => {
      const currentValue = (previous.requirements || '').toString();
      if (currentValue.trim().length > 0) return previous;
      return {
        ...previous,
        requirements: REQUIREMENTS_BULLET,
      };
    });
  };

  const handleRequirementsBlur = () => {
    setFormData((previous) => ({
      ...previous,
      requirements: normalizeRequirementsInputValue(previous.requirements),
    }));
  };

  const handleRequirementsKeyDown = (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const target = event.currentTarget;
    const currentValue = target.value || '';
    const selectionStart = typeof target.selectionStart === 'number' ? target.selectionStart : currentValue.length;
    const selectionEnd = typeof target.selectionEnd === 'number' ? target.selectionEnd : currentValue.length;

    const beforeSelection = currentValue.slice(0, selectionStart);
    const afterSelection = currentValue.slice(selectionEnd);
    const lineStartIndex = beforeSelection.lastIndexOf('\n') + 1;
    const currentLine = currentValue.slice(lineStartIndex, selectionStart);
    const currentLineStripped = currentLine.replace(/^\s*(?:[-*•]\s*|\d+[.)]\s*)?/, '').trim();

    // If user presses enter on an empty bullet, remove it instead of stacking blank bullets.
    const insertion = currentLineStripped.length > 0 ? `\n${REQUIREMENTS_BULLET}` : '\n';
    const nextValue = `${beforeSelection}${insertion}${afterSelection}`;
    const nextCaret = selectionStart + insertion.length;

    setFormData((previous) => ({
      ...previous,
      requirements: nextValue,
    }));

    requestAnimationFrame(() => {
      if (!target) return;
      target.selectionStart = nextCaret;
      target.selectionEnd = nextCaret;
    });
  };

  const handleAdvertImageFileChange = (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;

    setError('');
    const nextUploads = [];
    let rejectedCount = 0;

    files.forEach((file) => {
      if (!ADVERT_IMAGE_MIME_TYPES.includes(file.type) || file.size > MAX_ADVERT_IMAGE_BYTES) {
        rejectedCount += 1;
        return;
      }
      nextUploads.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (!nextUploads.length) {
      setError('Selected files must be JPG, PNG, WEBP, or GIF and each file must be 8 MB or less.');
      if (advertImageInputRef.current) {
        advertImageInputRef.current.value = '';
      }
      return;
    }

    if (rejectedCount > 0) {
      setError(`${rejectedCount} file(s) were skipped. Only JPG, PNG, WEBP, GIF up to 8 MB are allowed.`);
    }

    setAdvertImageUploads((previous) => [...previous, ...nextUploads]);
    if (advertImageInputRef.current) {
      advertImageInputRef.current.value = '';
    }
  };

  const handleAdvertVideoFileChange = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;

    setError('');
    if (!ADVERT_VIDEO_MIME_TYPES.includes(file.type)) {
      setError('Advert video must be MP4, WEBM, MOV, MKV, or OGG.');
      if (advertVideoInputRef.current) {
        advertVideoInputRef.current.value = '';
      }
      return;
    }

    if (file.size > MAX_ADVERT_VIDEO_BYTES) {
      setError('Advert video must be 50 MB or less.');
      if (advertVideoInputRef.current) {
        advertVideoInputRef.current.value = '';
      }
      return;
    }

    setAdvertVideoFile(file);
  };

  const handleCreateJob = () => {
    setSelectedJob(null);
    setShowAddSkillsSection(false);
    resetAdvertMediaState();
    setError('');
    setFormData({
      title: '',
      department: '',
      location: '',
      employmentType: 'FULL_TIME',
      experienceLevel: 'MID',
      description: '',
      requirements: '',
      benefits: '',
      salaryRange: '',
      salaryCurrency: 'LKR',
      salaryMin: '',
      salaryMax: '',
      postingDuration: '30',
      publishTiming: 'immediate',
      scheduledPublishAt: '',
      advertImageUrls: [],
      advertImageUrl: '',
      advertImageAlt: '',
      advertVideoUrl: '',
      status: 'DRAFT',
      requiredSkills: [],
      templateConfig: {
        interviewTypes: [],
        skillFocus: [],
        duration: 30,
      },
      customFormFields: [],
    });
    setShowCreateModal(true);
  };

  const handleEditJob = (job) => {
    setSelectedJob(job);
    setShowAddSkillsSection(false);
    resetAdvertMediaState();
    setError('');
    // Parse existing salary range if it exists
    const existingSalary = job.compensationRange || job.salaryRange || '';
    let parsedCurrency = job.salaryCurrency || 'LKR';
    if (!currencyOptions.find((currency) => currency.value === parsedCurrency)) {
      parsedCurrency = 'LKR';
    }
    let parsedMin = job.salaryMin || '';
    let parsedMax = job.salaryMax || '';
    const existingAdvertImageUrls = normalizeAdvertImageUrls(job);
    const isScheduledPublish = job.status === 'PUBLISHED' && Boolean(job.scheduledPublishAt) && !job.publishedAt;
    
    // Try to parse legacy format like "$80,000 - $120,000"
    if (existingSalary && !parsedMin && !parsedMax) {
      const rangeMatch = existingSalary.match(/([\d,]+)\s*[-\u2013]\s*([\d,]+)/);
      if (rangeMatch) {
        parsedMin = rangeMatch[1].replace(/,/g, '');
        parsedMax = rangeMatch[2].replace(/,/g, '');
      }
    }
    
    const customFormFields = Array.isArray(job.customFormFields) && job.customFormFields.length > 0
      ? normalizeCustomFormFields(job.customFormFields)
      : buildCustomFieldsFromApplicationQuestions(job.applicationQuestions || []);

    setFormData({
      title: job.title || '',
      department: job.department || '',
      location: job.location || '',
      employmentType: job.employmentType || 'FULL_TIME',
      experienceLevel: job.experienceLevel || 'MID',
      description: job.description || '',
      requirements: toRequirementsInputValue(job.requirements),
      benefits: job.benefits || '',
      salaryRange: existingSalary,
      salaryCurrency: parsedCurrency,
      salaryMin: parsedMin,
      salaryMax: parsedMax,
      postingDuration: String(job.postingDuration || 30),
      publishTiming: isScheduledPublish ? 'scheduled' : 'immediate',
      scheduledPublishAt: isScheduledPublish ? toDateTimeLocalValue(job.scheduledPublishAt) : '',
      advertImageUrls: existingAdvertImageUrls,
      advertImageUrl: existingAdvertImageUrls[0] || '',
      advertImageAlt: job.advertImageAlt || '',
      advertVideoUrl: job.advertVideoUrl || '',
      status: job.status || 'DRAFT',
      requiredSkills: Array.isArray(job.skills) ? job.skills : (job.skills ? [job.skills] : []),
      templateConfig: job.templateConfig || {
        interviewTypes: [],
        skillFocus: [],
        duration: 30,
      },
      customFormFields,
    });
    setShowCreateModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Validate salary range - min should not be greater than max
      if (formData.salaryMin && formData.salaryMax) {
        const minValue = parseInt(parseSalary(formData.salaryMin), 10);
        const maxValue = parseInt(parseSalary(formData.salaryMax), 10);
        if (minValue > maxValue) {
          setError('Minimum salary cannot be greater than maximum salary.');
          setSubmitting(false);
          return;
        }
      }

      const postingDurationValue = parseInt(String(formData.postingDuration || '').trim(), 10);
      if (!Number.isInteger(postingDurationValue) || postingDurationValue < 1 || postingDurationValue > 365) {
        setError('Posting duration must be between 1 and 365 days.');
        setSubmitting(false);
        return;
      }

      const shouldSchedulePublish = formData.status === 'PUBLISHED' && formData.publishTiming === 'scheduled';
      let scheduledPublishAtIso = null;
      if (shouldSchedulePublish) {
        if (!formData.scheduledPublishAt) {
          setError('Please choose a scheduled publish date and time.');
          setSubmitting(false);
          return;
        }
        const scheduledDate = new Date(formData.scheduledPublishAt);
        if (Number.isNaN(scheduledDate.getTime())) {
          setError('Scheduled publish date must be valid.');
          setSubmitting(false);
          return;
        }
        if (scheduledDate.getTime() <= Date.now()) {
          setError('Scheduled publish date must be in the future.');
          setSubmitting(false);
          return;
        }
        scheduledPublishAtIso = scheduledDate.toISOString();
      }

      // Build the salary range string from components
      const currencyConfig = currencyOptions.find(c => c.value === formData.salaryCurrency) || currencyOptions[0];
      let salaryRangeString = '';
      if (formData.salaryMin || formData.salaryMax) {
        const formattedMin = formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : '';
        const formattedMax = formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : '';
        if (formattedMin && formattedMax) {
          salaryRangeString = `${currencyConfig.symbol}${formattedMin} - ${currencyConfig.symbol}${formattedMax}`;
        } else if (formattedMin) {
          salaryRangeString = `${currencyConfig.symbol}${formattedMin}+`;
        } else if (formattedMax) {
          salaryRangeString = `Up to ${currencyConfig.symbol}${formattedMax}`;
        }
      }

      const sanitizedAdvertImageUrls = (formData.advertImageUrls || [])
        .map((url) => (typeof url === 'string' ? url.trim() : ''))
        .filter(Boolean);
      const primaryAdvertImageUrl = sanitizedAdvertImageUrls[0] || null;

      const normalizedCustomFormFields = normalizeCustomFormFields(formData.customFormFields || []);
      const applicationQuestions = buildApplicationQuestionsFromCustomFields(normalizedCustomFormFields);
      const normalizedRequirements = parseRequirementsToList(formData.requirements);

      // Prepare payload to match backend validation
      const payload = {
        title: formData.title,
        department: formData.department || undefined,
        location: formData.location || undefined,
        employmentType: formData.employmentType || undefined,
        experienceLevel: formData.experienceLevel || undefined,
        description: formData.description || undefined,
        compensationRange: salaryRangeString || formData.salaryRange || undefined, // Backend expects compensationRange
        salaryCurrency: formData.salaryCurrency || 'LKR',
        salaryMin: formData.salaryMin ? parseInt(parseSalary(formData.salaryMin), 10) : undefined,
        salaryMax: formData.salaryMax ? parseInt(parseSalary(formData.salaryMax), 10) : undefined,
        postingDuration: postingDurationValue,
        scheduledPublishAt: formData.status === 'PUBLISHED'
          ? (shouldSchedulePublish ? scheduledPublishAtIso : null)
          : null,
        advertImageUrls: sanitizedAdvertImageUrls,
        advertImageUrl: primaryAdvertImageUrl,
        advertImageAlt: (primaryAdvertImageUrl || advertImageUploads.length > 0) && formData.advertImageAlt?.trim()
          ? formData.advertImageAlt.trim()
          : null,
        advertVideoUrl: formData.advertVideoUrl?.trim() ? formData.advertVideoUrl.trim() : null,
        status: formData.status || 'DRAFT',
        // Convert bullet-style requirements input into a clean array payload.
        requirements: normalizedRequirements.length > 0
          ? normalizedRequirements
          : undefined,
        // Convert requiredSkills to skills array
        skills: formData.requiredSkills && formData.requiredSkills.length > 0
          ? formData.requiredSkills
          : undefined,
        // Include templateConfig if provided
        templateConfig: formData.templateConfig || undefined,
        // Store custom application fields in both schemas for compatibility.
        applicationQuestions: applicationQuestions.length > 0 ? applicationQuestions : undefined,
        customFormFields: normalizedCustomFormFields.length > 0 ? normalizedCustomFormFields : undefined,
      };

      // Remove undefined fields
      Object.keys(payload).forEach(key => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      let savedJob = null;
      if (selectedJob) {
        // Update existing job
        const result = await apiClient.jobs.update(selectedJob.id, payload);
        if (!result?.success) {
          setError(result?.error || 'Failed to update job');
          return;
        }
        savedJob = result.job || { id: selectedJob.id };
      } else {
        // Create new job
        const result = await apiClient.jobs.create(payload);
        if (!result?.success) {
          setError(result?.error || 'Failed to create job');
          return;
        }
        savedJob = result.job || null;
        if (savedJob?.id) {
          setSelectedJob(savedJob);
        }
      }

      if (savedJob?.id && advertImageUploads.length > 0) {
        for (const upload of advertImageUploads) {
          const imageResult = await apiClient.jobs.uploadAdvertImage(savedJob.id, upload.file, formData.advertImageAlt || '');
          if (!imageResult?.success) {
            throw new Error(imageResult?.error || 'Failed to upload advert image.');
          }
          savedJob = imageResult.job || savedJob;
        }
      }

      if (savedJob?.id && advertVideoFile) {
        const videoResult = await apiClient.jobs.uploadAdvertVideo(savedJob.id, advertVideoFile);
        if (!videoResult?.success) {
          throw new Error(videoResult?.error || 'Failed to upload advert video.');
        }
        savedJob = videoResult.job || savedJob;
      }

      await loadJobs();
      closeCreateModal();
    } catch (err) {
      // Extract validation errors from response
      if (err.errors && Array.isArray(err.errors)) {
        const errorMessages = err.errors.map(e => `${e.param || e.field}: ${e.msg || e.message}`).join(', ');
        setError(`Validation failed: ${errorMessages}`);
      } else if (err.error) {
        setError(err.error);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Failed to save job. Please check all required fields.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job?')) return;

    try {
      const result = await apiClient.jobs.remove(jobId);
      if (result.success) {
        setError('');
        await loadJobs();
      }
    } catch (err) {
      let deleteError = err;

      if (deleteError?.code === 'JOB_MUST_BE_ARCHIVED_BEFORE_DELETE') {
        const shouldArchiveFirst = confirm(
          'This job must be archived before deletion.\n\n' +
          'Press OK to archive it now and continue deleting.\n' +
          'Press Cancel to keep the job.',
        );

        if (!shouldArchiveFirst) {
          setError('Deletion cancelled. Archive the job first when you are ready to remove it.');
          return;
        }

        try {
          const archiveResult = await apiClient.jobs.update(jobId, { status: 'ARCHIVED' });
          if (!archiveResult?.success) {
            throw new Error(archiveResult?.error || 'Failed to archive job before deletion');
          }

          const archivedDeleteResult = await apiClient.jobs.remove(jobId);
          if (archivedDeleteResult.success) {
            setError('');
            await loadJobs();
            return;
          }
        } catch (archiveErr) {
          if (archiveErr?.code === 'ACTIVE_APPLICATIONS_REQUIRE_RESOLUTION') {
            deleteError = archiveErr;
          } else {
            setError(archiveErr.message || 'Failed to archive job before deleting');
            return;
          }
        }
      }

      if (deleteError?.code === 'ACTIVE_APPLICATIONS_REQUIRE_RESOLUTION') {
        const activeApplications = deleteError?.details?.activeApplications ?? 0;
        const shouldResolveAndDelete = confirm(
          `This job has ${activeApplications} active application${activeApplications === 1 ? '' : 's'}.\n\n` +
          'Best practice is to notify candidates and close these applications before deleting.\n\n' +
          'Press OK to auto-reject active applications, notify candidates, and then delete this job.\n' +
          'Press Cancel to keep the job and review candidates manually.',
        );

        if (!shouldResolveAndDelete) {
          setError('Deletion cancelled. You can archive the job to stop new applications while you review current candidates.');
          return;
        }

        try {
          const optionalResolutionMessage = prompt(
            'Optional message for candidates (included in closure email):',
            '',
          );
          if (optionalResolutionMessage === null) {
            setError('Deletion cancelled. No candidate message was sent.');
            return;
          }

          const resolvedResult = await apiClient.jobs.remove(jobId, {
            resolveActiveApplications: true,
            notifyCandidates: true,
            resolutionMessage: optionalResolutionMessage.trim() || undefined,
          });

          if (resolvedResult.success) {
            setError('');
            await loadJobs();
          }
          return;
        } catch (resolveErr) {
          setError(resolveErr.message || 'Failed to resolve applications and delete job');
          return;
        }
      }

      setError(deleteError.message || 'Failed to delete job');
    }
  };

  const handlePublishJob = async (jobId) => {
    try {
      const result = await apiClient.jobs.update(jobId, { status: 'PUBLISHED' });
      if (result.success) {
        await loadJobs();
      }
    } catch (err) {
      setError(err?.message || 'Failed to publish job');
    }
  };

  const handleArchiveJob = async (jobId) => {
    try {
      const result = await apiClient.jobs.update(jobId, { status: 'ARCHIVED' });
      if (result.success) {
        await loadJobs();
      }
    } catch (err) {
      setError(err?.message || 'Failed to archive job');
    }
  };

  const queueShareFeedback = (message, tone = 'success') => {
    setShareFeedback({ message, tone });
    if (shareFeedbackTimeoutRef.current) {
      clearTimeout(shareFeedbackTimeoutRef.current);
    }
    shareFeedbackTimeoutRef.current = setTimeout(() => {
      setShareFeedback({ message: '', tone: 'success' });
    }, 3200);
  };

  const handleShareJob = async (job) => {
    if (!job?.id) return;

    const jobUrl = `${window.location.origin}/jobs/${job.id}`;
    const shareCardUrl = buildJobShareCardUrl(job.id, {
      apiBaseUrl: API_URL,
      version: job.updatedAt || job.publishedAt || job.createdAt || '',
    });
    const sharePackage = buildJobSharePackage(job, {
      jobUrl,
      shareUrl: shareCardUrl,
      organizationName: organizationContext?.organization?.name || job?.organization?.name || '',
      apiBaseUrl: API_URL,
    });
    const isScheduledPublish = job.status === 'PUBLISHED' && Boolean(job.scheduledPublishAt) && !job.publishedAt;

    try {
      if (navigator.share) {
        const targetShareUrl = sharePackage.primaryShareUrl || jobUrl;
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

        await navigator.share(sharePayload);

        const mediaNotice = canAttachFiles
          ? ' Media files were attached.'
          : sharePackage.hasMedia
            ? ' Media preview is provided via the shared link.'
            : '';
        queueShareFeedback(
          isScheduledPublish
            ? 'Share ready. This role becomes visible at the scheduled publish time.'
            : `Share ready.${mediaNotice}`,
          'success',
        );
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(sharePackage.detailedText);
        const mediaNotice = sharePackage.hasMedia
          ? ' Media preview is provided via the shared link.'
          : '';
        queueShareFeedback(
          isScheduledPublish
            ? 'Detailed share package copied. This role becomes visible at the scheduled publish time.'
            : `Detailed job share package copied to clipboard.${mediaNotice}`,
          'success',
        );
        return;
      }

      queueShareFeedback('Sharing is unavailable in this browser.', 'error');
    } catch (err) {
      if (err?.name === 'AbortError') {
        return;
      }
      queueShareFeedback(err?.message || 'Failed to share job link.', 'error');
    }
  };

  const updateJobFilter = (key, value) => {
    setJobFilters((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const clearJobFilters = () => {
    setJobFilters(DEFAULT_COMPANY_JOB_FILTERS);
    setShowAdvancedFilters(false);
  };

  const jobFilterOptions = useMemo(() => ({
    employmentTypeOptions: [
      { value: 'all', label: 'All Employment Types' },
      ...Array.from(
        new Set(
          jobs
            .map((job) => job?.employmentType)
            .map((value) => value?.toString?.().trim())
            .filter(Boolean),
        ),
      ).map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) })),
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
      ).map((value) => ({ value, label: value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()) })),
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
  }), [jobs]);

  const activeJobFilterCount = countActiveCompanyJobFilters(jobFilters);
  const normalizedJobSearch = normalizeFilterValue(jobFilters.searchQuery);
  const jobSearchTokens = normalizedJobSearch.split(' ').filter(Boolean);

  const filteredJobs = useMemo(
    () => {
      const jobDateWindow = getCompanyJobDateWindow(jobFilters);
      return jobs
      .filter((job) => {
        const status = (job?.status || '').toString().toUpperCase();
        const applicationCount = Number(job?.applicationsCount || 0);
        const publishState = getCompanyJobPublishState(job);
        const locationMode = getCompanyJobLocationMode(job?.location);
        const createdAtValue = job?.createdAt || job?.publishedAt || null;
        const createdAt = createdAtValue ? new Date(createdAtValue) : null;
        const hasValidDate = createdAt && !Number.isNaN(createdAt.getTime());

        if (jobFilters.status !== 'all' && status !== jobFilters.status) return false;
        if (jobFilters.employmentType !== 'all' && (job?.employmentType || '') !== jobFilters.employmentType) return false;
        if (jobFilters.experienceLevel !== 'all' && (job?.experienceLevel || '') !== jobFilters.experienceLevel) return false;
        if (jobFilters.department !== 'all' && (job?.department || '') !== jobFilters.department) return false;
        if (jobFilters.locationMode !== 'all' && locationMode !== jobFilters.locationMode) return false;
        if (jobFilters.publishState !== 'all' && publishState !== jobFilters.publishState) return false;

        if (jobFilters.applicationState === 'with-applications' && applicationCount <= 0) return false;
        if (jobFilters.applicationState === 'without-applications' && applicationCount > 0) return false;

        if (jobDateWindow.from || jobDateWindow.to) {
          if (!hasValidDate) return false;
          if (jobDateWindow.from && createdAt < jobDateWindow.from) return false;
          if (jobDateWindow.to && createdAt > jobDateWindow.to) return false;
        }

        if (jobSearchTokens.length) {
          const searchableText = [
            job?.title || '',
            job?.department || '',
            job?.location || '',
            job?.description || '',
            job?.employmentType || '',
            job?.experienceLevel || '',
            ...(Array.isArray(job?.skills) ? job.skills : []),
          ]
            .join(' ')
            .toLowerCase();
          if (!jobSearchTokens.every((token) => searchableText.includes(token))) return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftDate = new Date(left?.createdAt || left?.publishedAt || 0).getTime() || 0;
        const rightDate = new Date(right?.createdAt || right?.publishedAt || 0).getTime() || 0;
        if (jobFilters.sortBy === 'oldest') return leftDate - rightDate;
        if (jobFilters.sortBy === 'applicationsDesc') return Number(right?.applicationsCount || 0) - Number(left?.applicationsCount || 0);
        if (jobFilters.sortBy === 'titleAsc') return (left?.title || '').localeCompare(right?.title || '');
        if (jobFilters.sortBy === 'status') return (left?.status || '').localeCompare(right?.status || '');
        return rightDate - leftDate;
      });
    },
    [jobs, jobFilters],
  );

  const existingAdvertImagePreviewItems = (formData.advertImageUrls || [])
    .map((url, index) => ({
      id: `saved-${index}-${url}`,
      source: toAbsoluteAssetUrl(url),
      originalUrl: url,
      type: 'saved',
    }))
    .filter((item) => item.source);
  const pendingAdvertImagePreviewItems = advertImageUploads
    .map((upload) => ({
      id: upload.id,
      source: upload.previewUrl,
      type: 'pending',
    }))
    .filter((item) => item.source);
  const advertImagePreviewItems = [...existingAdvertImagePreviewItems, ...pendingAdvertImagePreviewItems];
  const advertVideoSource = advertVideoPreview || toAbsoluteAssetUrl(formData.advertVideoUrl);

  const getStatusColor = (status) => {
    switch (status) {
      case 'PUBLISHED':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'DRAFT':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'ARCHIVED':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const handleAddSkillsFromInput = () => {
    const inputValue = keySkillsInputRef.current?.value?.trim();
    if (!inputValue) {
      return;
    }

    const parsedSkills = inputValue
      .split(',')
      .map((skill) => skill.trim())
      .filter(Boolean);

    setFormData((prev) => ({
      ...prev,
      requiredSkills: mergeUniqueSkills(prev.requiredSkills, parsedSkills),
    }));

    if (keySkillsInputRef.current) {
      keySkillsInputRef.current.value = '';
    }
  };

  const removeSavedAdvertImage = (imageUrlToRemove) => {
    setFormData((prev) => {
      const nextAdvertImageUrls = (prev.advertImageUrls || []).filter((url) => url !== imageUrlToRemove);
      const hasAnyImages = nextAdvertImageUrls.length > 0 || advertImageUploadsRef.current.length > 0;
      return {
        ...prev,
        advertImageUrls: nextAdvertImageUrls,
        advertImageUrl: nextAdvertImageUrls[0] || '',
        advertImageAlt: hasAnyImages ? prev.advertImageAlt : '',
      };
    });
  };

  const removePendingAdvertImage = (uploadIdToRemove) => {
    setAdvertImageUploads((previous) => {
      const targetUpload = previous.find((upload) => upload.id === uploadIdToRemove);
      if (targetUpload?.previewUrl) {
        URL.revokeObjectURL(targetUpload.previewUrl);
      }
      const nextUploads = previous.filter((upload) => upload.id !== uploadIdToRemove);
      if (nextUploads.length === 0) {
        setFormData((prev) => {
          if ((prev.advertImageUrls || []).length > 0) {
            return prev;
          }
          return { ...prev, advertImageAlt: '' };
        });
      }
      return nextUploads;
    });
  };

  const togglePresetSkill = (presetSkill) => {
    if (normalizeSkillValue(presetSkill) === 'other') {
      setShowAddSkillsSection((previous) => {
        const next = !previous;
        if (next && typeof window !== 'undefined') {
          window.requestAnimationFrame(() => {
            keySkillsInputRef.current?.focus?.();
          });
        }
        return next;
      });
      return;
    }

    const normalizedPreset = normalizeSkillValue(presetSkill);

    setFormData((prev) => {
      const exists = prev.requiredSkills.some(
        (skill) => normalizeSkillValue(skill) === normalizedPreset,
      );

      if (exists) {
        return {
          ...prev,
          requiredSkills: prev.requiredSkills.filter(
            (skill) => normalizeSkillValue(skill) !== normalizedPreset,
          ),
        };
      }

      return {
        ...prev,
        requiredSkills: mergeUniqueSkills(prev.requiredSkills, [presetSkill]),
      };
    });
  };

  const removeSkill = (skillToRemove) => {
    const normalizedTarget = normalizeSkillValue(skillToRemove);
    setFormData((prev) => ({
      ...prev,
      requiredSkills: prev.requiredSkills.filter(
        (skill) => normalizeSkillValue(skill) !== normalizedTarget,
      ),
    }));
  };

  const selectedCustomSkills = formData.requiredSkills.filter(
    (skill) => !PRESET_JOB_SKILLS.some(
      (presetSkill) => normalizeSkillValue(presetSkill) === normalizeSkillValue(skill),
    ),
  );
  const scheduleMinDateTime = toDateTimeLocalValue(new Date(Date.now() + 60 * 1000).toISOString());
  const scheduleTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 transition-colors duration-300">
      <Header 
        userType="company"
        isAuthenticated
        onLogout={handleLogout}
        organizationRole={user?.organizationContext?.membership?.role}
      />
      
      {/* Spacer for fixed header */}
      <div className="h-14 xs:h-16" />
      
      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row">
          <UserContextNavigation
            userType="company"
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
          
          <main className={`flex-1 transition-all duration-300 pb-20 lg:pb-0 ${
            isSidebarCollapsed ? 'lg:ml-20' : 'lg:ml-72 xl:ml-80'
          }`}>
            <div className="container-responsive py-4 sm:py-6 space-y-4 sm:space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <Icon name="Briefcase" size={22} color="white" />
                  </div>
                  <div>
                    <h1 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 dark:text-slate-100 leading-tight">
                      Job Postings
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      Manage your job listings and track applications.
                    </p>
                  </div>
                </div>
                {organizationContext?.organization?.status !== 'PENDING' && canCreateJobs && (
                  <Button
                    onClick={handleCreateJob}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shrink-0"
                  >
                    <Icon name="Plus" size={18} className="mr-1.5" />
                    Create Job
                  </Button>
                )}
                {organizationContext?.organization?.status !== 'PENDING' && !canCreateJobs && (
                  <div className="text-sm text-gray-500 dark:text-slate-400 italic">
                    View-only access
                  </div>
                )}
              </div>

              {organizationContext?.organization?.status !== 'PENDING' && pendingRealtimeJobUpdates > 0 && (
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

              {/* Pending Approval Message */}
              {organizationContext?.organization?.status === 'PENDING' ? (
                <div className="rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/90 dark:bg-slate-800/90 p-6 shadow-lg">
                  <div className="text-center py-12">
                    <Icon name="AlertCircle" className="w-12 h-12 text-red-600 mx-auto mb-3" />
                    <p className="text-gray-900 dark:text-slate-100 mb-4">
                      Organization pending approval. Please wait for system administrator review.
                    </p>
                    <Button 
                      onClick={async () => {
                        setRefreshing(true);
                        try {
                          await refresh();
                          await loadJobs();
                        } catch {
                          // Silent failure -- page remains as-is
                        } finally {
                          setRefreshing(false);
                        }
                      }}
                      loading={refreshing}
                      disabled={refreshing}
                    >
                      {refreshing ? 'Checking...' : 'Retry'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
              {/* Filters */}
              <UnifiedFilterPanel
                title="Job Posting Filters"
                description="Filter postings by status, publish state, role metadata, application volume, and date windows."
                activeCount={activeJobFilterCount}
                onClear={clearJobFilters}
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
                    value={jobFilters.searchQuery}
                    onChange={(event) => updateJobFilter('searchQuery', event.target.value)}
                    placeholder="Role, department, location, skill, or description"
                  />
                  <UnifiedFilterSelect
                    label="Status"
                    value={jobFilters.status}
                    onChange={(value) => updateJobFilter('status', value)}
                    options={[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'DRAFT', label: 'Draft' },
                      { value: 'PUBLISHED', label: 'Published' },
                      { value: 'ARCHIVED', label: 'Archived' },
                    ]}
                  />
                  <UnifiedFilterSelect
                    label="Publish State"
                    value={jobFilters.publishState}
                    onChange={(value) => updateJobFilter('publishState', value)}
                    options={COMPANY_JOB_PUBLISH_STATE_OPTIONS}
                  />
                  <UnifiedFilterSelect
                    label="Employment Type"
                    value={jobFilters.employmentType}
                    onChange={(value) => updateJobFilter('employmentType', value)}
                    options={jobFilterOptions.employmentTypeOptions}
                  />
                  <UnifiedFilterSelect
                    label="Experience Level"
                    value={jobFilters.experienceLevel}
                    onChange={(value) => updateJobFilter('experienceLevel', value)}
                    options={jobFilterOptions.experienceLevelOptions}
                  />
                </div>

                {showAdvancedFilters && (
                  <div className={FILTER_SUBPANEL_CLASS}>
                    <div className={FILTER_GRID_CLASS}>
                      <UnifiedFilterSelect
                        label="Department"
                        value={jobFilters.department}
                        onChange={(value) => updateJobFilter('department', value)}
                        options={jobFilterOptions.departmentOptions}
                      />
                      <UnifiedFilterSelect
                        label="Location Mode"
                        value={jobFilters.locationMode}
                        onChange={(value) => updateJobFilter('locationMode', value)}
                        options={COMPANY_JOB_LOCATION_MODE_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Applications"
                        value={jobFilters.applicationState}
                        onChange={(value) => updateJobFilter('applicationState', value)}
                        options={COMPANY_JOB_APPLICATION_STATE_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Created Date"
                        value={jobFilters.datePreset}
                        onChange={(value) => updateJobFilter('datePreset', value)}
                        options={COMPANY_JOB_DATE_PRESET_OPTIONS}
                      />
                      <UnifiedFilterSelect
                        label="Sort By"
                        value={jobFilters.sortBy}
                        onChange={(value) => updateJobFilter('sortBy', value)}
                        options={COMPANY_JOB_SORT_OPTIONS}
                      />
                    </div>

                    {jobFilters.datePreset === 'custom' && (
                      <div className={FILTER_DATE_GRID_CLASS}>
                        <label className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Created From</span>
                          <UnifiedTextInput
                            type="date"
                            value={jobFilters.from}
                            onChange={(event) => updateJobFilter('from', event.target.value)}
                          />
                        </label>
                        <label className="space-y-1.5">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Created To</span>
                          <UnifiedTextInput
                            type="date"
                            value={jobFilters.to}
                            onChange={(event) => updateJobFilter('to', event.target.value)}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </UnifiedFilterPanel>

              {/* Jobs List */}
              {loading ? (
                <LoadingState
                  title="Loading job postings"
                  message="Syncing roles, applications, and status updates."
                  variant="card"
                  tone="primary"
                />
              ) : filteredJobs.length === 0 ? (
                <div className="card-base p-8 text-center">
                  <Icon name="Briefcase" size={48} className="mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                    No jobs found
                  </h3>
                  <p className="text-gray-600 dark:text-slate-400 mb-4">
                    {activeJobFilterCount > 0
                      ? 'No job postings match your selected filters. Clear filters to broaden your results.'
                      : 'Create your first job posting to start receiving applications.'}
                  </p>
                  {organizationContext?.organization?.status !== 'PENDING' && (
                    <Button onClick={handleCreateJob}>
                      <Icon name="Plus" size={18} className="mr-1.5" />
                      Create Job
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 relative z-0">
                  {filteredJobs.map((job) => (
                    <motion.div
                      key={job.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="card-base p-4 sm:p-6 hover:shadow-lg transition-shadow relative z-0"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 truncate">
                                {job.title}
                              </h3>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                                  {job.status}
                                </span>
                                {job.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                                    <Icon name="Clock" size={12} />
                                    Scheduled
                                  </span>
                                )}
                                {job.advertImageUrl && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                    <Icon name="Image" size={12} />
                                    Image advert
                                  </span>
                                )}
                                {job.advertVideoUrl && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                                    <Icon name="Video" size={12} />
                                    Video advert
                                  </span>
                                )}
                                {job.department && (
                                  <span className="text-sm text-gray-600 dark:text-slate-400">
                                    {job.department}
                                  </span>
                                )}
                                {job.location && (
                                  <span className="text-sm text-gray-600 dark:text-slate-400 flex items-center gap-1">
                                    <Icon name="MapPin" size={14} />
                                    {job.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {job.description && (
                            <p className="text-sm text-gray-600 dark:text-slate-400 line-clamp-2 mb-3">
                              {job.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              <Icon name="Users" size={16} />
                              {job.applicationsCount || 0} applications
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon name="Clock" size={16} />
                              {new Date(job.createdAt).toLocaleDateString()}
                            </span>
                            {job.status === 'PUBLISHED' && job.scheduledPublishAt && !job.publishedAt && (
                              <span className="flex items-center gap-1 text-indigo-700 dark:text-indigo-300">
                                <Icon name="Calendar" size={16} />
                                Publishes {formatDateTime(job.scheduledPublishAt)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {canEditJobs && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditJob(job)}
                            >
                              <Icon name="Edit" size={16} className="mr-1.5" />
                              Edit
                            </Button>
                          )}
                          {canEditJobs && job.status === 'DRAFT' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePublishJob(job.id)}
                              className="text-green-600 border-green-600 hover:bg-green-50"
                            >
                              <Icon name="Send" size={16} className="mr-1.5" />
                              Publish
                            </Button>
                          )}
                          {job.status === 'PUBLISHED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleShareJob(job)}
                              className="text-blue-600 border-blue-600 hover:bg-blue-50"
                              title="Share public job link"
                            >
                              <Icon name="Link" size={16} className="mr-1.5" />
                              Share
                            </Button>
                          )}
                          {canEditJobs && job.status === 'PUBLISHED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleArchiveJob(job.id)}
                              className="text-orange-600 border-orange-600 hover:bg-orange-50"
                            >
                              <Icon name="Archive" size={16} className="mr-1.5" />
                              Archive
                            </Button>
                          )}
                          {canDeleteJobs && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteJob(job.id)}
                              className="text-red-600 border-red-600 hover:bg-red-50"
                            >
                              <Icon name="Trash2" size={16} />
                            </Button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {shareFeedback.message && (
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 32 }}
          className="fixed bottom-5 right-5 z-[60] max-w-md"
        >
          <div
            className={cn(
              'rounded-2xl border px-4 py-3 shadow-xl',
              shareFeedback.tone === 'error'
                ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
                : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200',
            )}
          >
            <div className="flex items-start gap-2">
              <Icon
                name={shareFeedback.tone === 'error' ? 'AlertCircle' : 'CheckCircle'}
                size={16}
                className="mt-0.5 shrink-0"
              />
              <p className="text-sm">{shareFeedback.message}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Create/Edit Job Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
            onClick={closeCreateModal}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                  {selectedJob ? 'Edit Job' : 'Create New Job'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300">
                    {error}
                  </div>
                )}

                <Input
                  label="Job Title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                  placeholder="e.g. Senior Frontend Developer"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Department"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    placeholder="e.g. Engineering"
                  />
                  
                  {/* Location with detect button */}
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-sm font-medium leading-none text-foreground">
                      Location
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={isDetectingLocation && locationFeedback?.message ? locationFeedback.message : formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        placeholder="e.g. San Francisco, CA"
                        disabled={isDetectingLocation}
                        className="flex h-11 sm:h-12 w-full rounded-xl border border-input bg-background px-3 sm:px-4 pr-[90px] sm:pr-[100px] py-2.5 text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200 min-h-[44px]"
                      />
                      <button
                        type="button"
                        onClick={handleDetectLocation}
                        disabled={isDetectingLocation}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isDetectingLocation ? (
                          <>
                            <LoadingIndicator size={14} tone="current" />
                            <span className="hidden sm:inline">Detecting</span>
                          </>
                        ) : (
                          <>
                            <Icon name="MapPin" size={14} />
                            <span className="hidden sm:inline">Detect</span>
                          </>
                        )}
                      </button>
                    </div>
                    {locationFeedback?.status === 'error' && locationFeedback?.message && (
                      <p className="text-xs sm:text-sm text-destructive flex items-start gap-1.5">
                        <Icon name="AlertCircle" size={12} className="mt-0.5 flex-shrink-0" />
                        {locationFeedback.message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select
                    label="Employment Type"
                    value={formData.employmentType}
                    onChange={(value) => setFormData({ ...formData, employmentType: value })}
                    options={[
                      { value: 'FULL_TIME', label: 'Full-time' },
                      { value: 'PART_TIME', label: 'Part-time' },
                      { value: 'CONTRACT', label: 'Contract' },
                      { value: 'INTERNSHIP', label: 'Internship' },
                    ]}
                  />
                  <Select
                    label="Experience Level"
                    value={formData.experienceLevel}
                    onChange={(value) => setFormData({ ...formData, experienceLevel: value })}
                    options={[
                      { value: 'ENTRY', label: 'Entry Level' },
                      { value: 'MID', label: 'Mid Level' },
                      { value: 'SENIOR', label: 'Senior' },
                      { value: 'LEAD', label: 'Lead' },
                    ]}
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Description <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={4}
                    className="w-full px-3 sm:px-4 py-2.5 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 resize-y min-h-[100px]"
                    placeholder="Describe the role, responsibilities, and what you're looking for..."
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Requirements
                  </label>
                  <textarea
                    value={formData.requirements}
                    onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                    onFocus={handleRequirementsFocus}
                    onBlur={handleRequirementsBlur}
                    onKeyDown={handleRequirementsKeyDown}
                    rows={3}
                    className="w-full px-3 sm:px-4 py-2.5 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200 resize-y min-h-[80px]"
                    placeholder="• List required skills, qualifications, and experience (press Enter for next bullet)"
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
                  <div className="flex items-start gap-2">
                    <Icon name="ImagePlus" size={18} className="text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                        Optional Job Advert Media
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-slate-400">
                        Add one or more images and up to one short video for this job post.
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                        Media previews use a responsive layout similar to modern job posting pages.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-800 dark:text-slate-200">Advert images</div>
                      </div>

                      {advertImagePreviewItems.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {advertImagePreviewItems.map((imageItem) => (
                            <div key={imageItem.id} className="relative">
                              <div className="w-full aspect-[16/10] min-h-[11rem] rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 overflow-hidden flex items-center justify-center">
                                <img
                                  src={imageItem.source}
                                  alt={formData.advertImageAlt || 'Job advert image preview'}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <button
                                type="button"
                                className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors z-10 border-2 border-white dark:border-slate-800"
                                aria-label="Remove image"
                                title="Remove image"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (imageItem.type === 'saved') {
                                    removeSavedAdvertImage(imageItem.originalUrl);
                                  } else {
                                    removePendingAdvertImage(imageItem.id);
                                  }
                                }}
                              >
                                <Icon name="X" size={12} color="white" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={(event) => {
                              if (isResizeHandleClick(event)) return;
                              advertImageInputRef.current?.click();
                            }}
                            className="w-full aspect-[16/10] min-h-[11rem] rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                            title="Click to upload image"
                            aria-label="Upload another advert image"
                          >
                            <div className="text-center text-gray-500 dark:text-slate-400">
                              <Icon name="Image" size={24} className="mx-auto mb-2" />
                              <p className="text-xs">No image selected (click to upload)</p>
                            </div>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            if (isResizeHandleClick(event)) return;
                            advertImageInputRef.current?.click();
                          }}
                          className="w-full aspect-[16/10] min-h-[11rem] rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                          title="Click to upload image"
                          aria-label="Upload advert image"
                        >
                          <div className="text-center text-gray-500 dark:text-slate-400">
                            <Icon name="Image" size={24} className="mx-auto mb-2" />
                            <p className="text-xs">No images selected (click to upload)</p>
                          </div>
                        </button>
                      )}

                      <Input
                        label="Image alt text (optional)"
                        value={formData.advertImageAlt}
                        onChange={(e) => setFormData({ ...formData, advertImageAlt: e.target.value })}
                        placeholder="Describe the images for accessibility"
                      />
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Allowed: JPG, PNG, WEBP, GIF. Max 8 MB each. Multiple images allowed.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-medium text-gray-800 dark:text-slate-200">Advert video</div>
                      </div>

                      <div className="relative">
                        {advertVideoSource ? (
                          <div className="w-full aspect-video min-h-[11rem] rounded-xl border border-gray-200 dark:border-slate-700 bg-black overflow-hidden flex items-center justify-center">
                            <video
                              src={advertVideoSource}
                              controls
                              preload="metadata"
                              className="w-full h-full object-contain"
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              if (isResizeHandleClick(event)) return;
                              advertVideoInputRef.current?.click();
                            }}
                            className="w-full aspect-video min-h-[11rem] rounded-xl border border-gray-200 dark:border-slate-700 bg-black overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                            title="Click to upload video"
                            aria-label="Upload advert video"
                          >
                            <div className="text-center text-gray-300">
                              <Icon name="Video" size={24} className="mx-auto mb-2" />
                              <p className="text-xs">No video selected (click to upload)</p>
                            </div>
                          </button>
                        )}
                        {advertVideoSource && (
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition-colors z-10 border-2 border-white dark:border-slate-800"
                            aria-label="Remove video"
                            title="Remove video"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAdvertVideoFile(null);
                              if (advertVideoInputRef.current) {
                                advertVideoInputRef.current.value = '';
                              }
                              setFormData((prev) => ({ ...prev, advertVideoUrl: '' }));
                            }}
                          >
                            <Icon name="X" size={12} color="white" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Allowed: MP4, WEBM, MOV, MKV, OGG. Max 50 MB. Only one video is allowed.
                      </p>
                    </div>
                  </div>

                  <input
                    ref={advertImageInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={handleAdvertImageFileChange}
                  />
                  <input
                    ref={advertVideoInputRef}
                    type="file"
                    accept=".mp4,.webm,.mov,.mkv,.ogv,video/mp4,video/webm,video/quicktime,video/x-matroska,video/ogg"
                    className="hidden"
                    onChange={handleAdvertVideoFileChange}
                  />
                </div>

                {/* Salary Range Section */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Salary Range
                  </label>
                  
                  {/* Currency Selector */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="sm:w-40">
                      <Select
                        value={formData.salaryCurrency}
                        onChange={(value) => setFormData({ ...formData, salaryCurrency: value })}
                        options={currencyOptions.map((currency) => ({
                          value: currency.value,
                          label: currency.label,
                        }))}
                        placeholder="Currency"
                      />
                    </div>
                    
                    {/* Min/Max Salary Inputs */}
                    <div className="flex-1 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          {currencyOptions.find(c => c.value === formData.salaryCurrency)?.symbol || 'Rs'}
                        </span>
                        <input
                          type="text"
                          value={formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : ''}
                          onChange={(e) => {
                            const raw = parseSalary(e.target.value);
                            setFormData({ ...formData, salaryMin: raw });
                          }}
                          placeholder="Min"
                          className="w-full h-11 sm:h-12 pl-8 pr-3 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        />
                      </div>
                      
                      <span className="text-muted-foreground font-medium">-</span>
                      
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                          {currencyOptions.find(c => c.value === formData.salaryCurrency)?.symbol || 'Rs'}
                        </span>
                        <input
                          type="text"
                          value={formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : ''}
                          onChange={(e) => {
                            const raw = parseSalary(e.target.value);
                            setFormData({ ...formData, salaryMax: raw });
                          }}
                          placeholder="Max"
                          className="w-full h-11 sm:h-12 pl-8 pr-3 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Preview */}
                  {(formData.salaryMin || formData.salaryMax) && (
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Preview: {(() => {
                        const currencyConfig = currencyOptions.find(c => c.value === formData.salaryCurrency) || currencyOptions[0];
                        const formattedMin = formData.salaryMin ? formatSalary(formData.salaryMin, formData.salaryCurrency) : '';
                        const formattedMax = formData.salaryMax ? formatSalary(formData.salaryMax, formData.salaryCurrency) : '';
                        if (formattedMin && formattedMax) {
                          return `${currencyConfig.symbol}${formattedMin} - ${currencyConfig.symbol}${formattedMax}`;
                        } else if (formattedMin) {
                          return `${currencyConfig.symbol}${formattedMin}+`;
                        } else if (formattedMax) {
                          return `Up to ${currencyConfig.symbol}${formattedMax}`;
                        }
                        return '';
                      })()}
                    </p>
                  )}
                </div>

                {/* Key Skills */}
                <div className="space-y-1.5 sm:space-y-2">
                  <label className="text-sm font-medium leading-none text-foreground">
                    Key Skills
                  </label>
                  <div className="space-y-2">
                    <div className="space-y-2">
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Suggested skills
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {PRESET_JOB_SKILLS.map((presetSkill) => {
                          const isOtherSkill = normalizeSkillValue(presetSkill) === 'other';
                          const isSelected = isOtherSkill
                            ? showAddSkillsSection
                            : formData.requiredSkills.some(
                              (skill) => normalizeSkillValue(skill) === normalizeSkillValue(presetSkill),
                            );

                          return (
                            <button
                              key={presetSkill}
                              type="button"
                              onClick={() => togglePresetSkill(presetSkill)}
                              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${
                                isSelected
                                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                                  : 'bg-white/80 dark:bg-slate-800/80 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                              }`}
                            >
                              <span className="inline-flex items-center gap-1">
                                {presetSkill}
                                {isSelected && <Icon name="X" size={12} />}
                              </span>
                            </button>
                          );
                        })}
                        {selectedCustomSkills.map((customSkill) => (
                          <button
                            key={customSkill}
                            type="button"
                            onClick={() => removeSkill(customSkill)}
                            className="px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 bg-blue-600 text-white shadow-md shadow-blue-500/30"
                            title={`Remove ${customSkill}`}
                            aria-label={`Remove ${customSkill}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {customSkill}
                              <Icon name="X" size={12} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                    {showAddSkillsSection && (
                      <>
                        <div className="flex gap-2">
                          <input
                            ref={keySkillsInputRef}
                            type="text"
                            placeholder="Add skills (e.g. React, JavaScript, Python)"
                            className="flex-1 h-11 sm:h-12 px-3 sm:px-4 border border-input bg-background rounded-xl text-base sm:text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-200"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                e.preventDefault();
                                handleAddSkillsFromInput();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault();
                              handleAddSkillsFromInput();
                            }}
                          >
                            <Icon name="Plus" size={16} className="mr-1.5" />
                            Add
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Separate multiple skills with commas. Press Enter or click Add.
                        </p>
                      </>
                    )}
                  </div>
                </div>

                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(value) => setFormData((prev) => ({
                    ...prev,
                    status: value,
                    publishTiming: value === 'PUBLISHED' ? prev.publishTiming : 'immediate',
                    scheduledPublishAt: value === 'PUBLISHED'
                      ? (prev.publishTiming === 'scheduled'
                        ? (prev.scheduledPublishAt || scheduleMinDateTime)
                        : prev.scheduledPublishAt)
                      : '',
                  }))}
                  options={[
                    { value: 'DRAFT', label: 'Draft' },
                    { value: 'PUBLISHED', label: 'Published' },
                    { value: 'ARCHIVED', label: 'Archived' },
                  ]}
                />

                <Select
                  label="Publish Timing"
                  value={formData.publishTiming}
                  onChange={(value) => setFormData((prev) => ({
                    ...prev,
                    publishTiming: value,
                    scheduledPublishAt: value === 'scheduled'
                      ? (prev.scheduledPublishAt || scheduleMinDateTime)
                      : '',
                  }))}
                  options={[
                    { value: 'immediate', label: 'Publish immediately' },
                    { value: 'scheduled', label: 'Schedule for later' },
                  ]}
                  disabled={formData.status !== 'PUBLISHED'}
                />
                {formData.status !== 'PUBLISHED' && (
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Set status to Published to enable scheduling.
                  </p>
                )}
                {formData.status === 'PUBLISHED' && formData.publishTiming === 'scheduled' && (
                  <>
                    <ScheduleDateTimePicker
                      value={formData.scheduledPublishAt}
                      minValue={scheduleMinDateTime}
                      timezoneLabel={scheduleTimezone}
                      onChange={(nextValue) => setFormData((prev) => ({ ...prev, scheduledPublishAt: nextValue }))}
                      required
                    />
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      This job will become publicly visible at the scheduled time.
                    </p>
                  </>
                )}

                <Input
                  label="Posting Duration (days)"
                  type="number"
                  min="1"
                  max="365"
                  value={formData.postingDuration}
                  onChange={(e) => setFormData({ ...formData, postingDuration: e.target.value })}
                  placeholder="30"
                  description="Controls how long the job stays active before it expires."
                />

                {/* Custom Application Form Builder */}
                <ApplicationFormBuilder
                  fields={formData.customFormFields || []}
                  onChange={(fields) => setFormData((p) => ({ ...p, customFormFields: fields }))}
                />

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCreateModal}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                  >
                    {submitting ? 'Saving...' : selectedJob ? 'Update Job' : 'Create Job'}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompanyJobsPage;
