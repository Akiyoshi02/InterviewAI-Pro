import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';
import apiClient from '../../services/apiClient.js';
import {
  getRecruiterMeetingLinkRescheduleDescription,
  getRecruiterMeetingLinkScheduledDescription,
  getRecruiterMeetingLinkUnscheduledDescription,
} from '../../constants/interviewMeetingLink.js';
import {
  buildManualWindowBounds,
  buildSuggestedManualSlots,
  formatMinutesOfDay,
  formatWorkingDays,
  getAvailabilitySourceLabel,
  toLocalDatetimeValue,
  validateManualInterviewSelection,
} from '../../utils/interviewSchedulingGuidance.js';
import {
  buildReviewerAssignmentOptions,
  summarizeReviewerAssignees,
} from '../../utils/reviewerAssignments.js';

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
];

const formatSlotDate = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  } catch { return iso; }
};

const buildSlotReasonText = (decision) => {
  if (!decision) return null;
  const { source, preferredSlotEvaluations } = decision;
  if (source === 'PREFERRED_SLOT') {
    return 'Candidate\u2019s preferred slot was available and accepted.';
  }
  if (source === 'AUTO_EARLIEST') {
    const hasPreferred = Array.isArray(preferredSlotEvaluations) && preferredSlotEvaluations.length > 0;
    if (hasPreferred) {
      const reasons = preferredSlotEvaluations
        .filter((e) => !e.isValid)
        .map((e) => {
          const codes = (e.reasonCodes || []).map((c) => c.replace(/_/g, ' ').toLowerCase());
          return `${formatSlotDate(e.scheduledFor)} \u2014 ${codes.join(', ') || 'unavailable'}`;
        });
      return [
        'None of the candidate\u2019s preferred slots were available, so the earliest valid slot was assigned.',
        ...reasons,
      ].join('\n');
    }
    return 'Earliest available slot was assigned based on working hours and availability.';
  }
  if (source === 'MANUAL') return null;
  return null;
};

const resolveDefaultStrategy = ({ interview, pendingRequest }) => {
  const isHiringInterview = String(interview?.mode || 'HIRING').toUpperCase() === 'HIRING';
  if (!isHiringInterview) return 'MANUAL';
  if (pendingRequest) return 'PREFERRED_FIRST';
  return 'MANUAL';
};

const defaultDatetime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 30));
  d.setSeconds(0);
  d.setMilliseconds(0);
  return toLocalDatetimeValue(d);
};

const demoBypassDatetime = () => {
  const d = new Date(Date.now() + (2 * 60 * 1000));
  d.setSeconds(0);
  d.setMilliseconds(0);
  return toLocalDatetimeValue(d);
};

const minimumDatetime = () => {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() + 1);
  return toLocalDatetimeValue(d);
};

const ScheduleInterviewModal = ({ interview, isOpen, onClose, onScheduled }) => {
  const modalTitleId = 'schedule-interview-modal-title';
  const [scheduledFor, setScheduledFor] = useState(
    interview?.scheduledFor ? toLocalDatetimeValue(new Date(interview.scheduledFor)) : defaultDatetime()
  );
  const [duration, setDuration] = useState(interview?.duration || 30);
  const [timezone, setTimezone] = useState(
    interview?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successInfo, setSuccessInfo] = useState(null);
  const [schedulingConstraints, setSchedulingConstraints] = useState(interview?.schedulingConstraints || null);
  const [constraintsLoading, setConstraintsLoading] = useState(false);
  const [constraintsError, setConstraintsError] = useState(interview?.schedulingConstraintsError?.message || null);
  const [reviewerAssignments, setReviewerAssignments] = useState(
    Array.isArray(interview?.reviewerAssignments) ? interview.reviewerAssignments : [],
  );
  const [reviewerOptions, setReviewerOptions] = useState([]);
  const [reviewerOptionsLoading, setReviewerOptionsLoading] = useState(false);
  const [reviewerOptionsError, setReviewerOptionsError] = useState(null);
  const [demoBypassAvailability, setDemoBypassAvailability] = useState(false);

  const isReschedule = !!interview?.scheduledFor;
  const pendingRescheduleRequest = interview?.pendingRescheduleRequest
    || (Array.isArray(interview?.rescheduleRequests)
      ? [...interview.rescheduleRequests].reverse().find((request) => request?.status === 'PENDING')
      : null);
  const [schedulingStrategy, setSchedulingStrategy] = useState(
    resolveDefaultStrategy({ interview, pendingRequest: pendingRescheduleRequest }),
  );
  const isHiringInterview = String(interview?.mode || 'HIRING').toUpperCase() === 'HIRING';
  const autoStrategyValue = pendingRescheduleRequest ? 'PREFERRED_FIRST' : 'AUTO';
  const effectiveStrategy = isHiringInterview ? schedulingStrategy : 'MANUAL';

  useEffect(() => {
    if (!isOpen) return;
    setScheduledFor(
      interview?.scheduledFor ? toLocalDatetimeValue(new Date(interview.scheduledFor)) : defaultDatetime(),
    );
    setDuration(interview?.duration || 30);
    setTimezone(interview?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    setNotes('');
    setSchedulingStrategy(resolveDefaultStrategy({ interview, pendingRequest: pendingRescheduleRequest }));
    setError(null);
    setSuccessInfo(null);
    setSchedulingConstraints(interview?.schedulingConstraints || null);
    setConstraintsError(interview?.schedulingConstraintsError?.message || null);
    setConstraintsLoading(false);
    setReviewerAssignments(Array.isArray(interview?.reviewerAssignments) ? interview.reviewerAssignments : []);
    setReviewerOptions([]);
    setReviewerOptionsError(null);
    setReviewerOptionsLoading(false);
    setDemoBypassAvailability(false);
  }, [interview, isOpen, pendingRescheduleRequest]);

  useEffect(() => {
    if (!isOpen || !isHiringInterview || !interview?.id) {
      return undefined;
    }

    let cancelled = false;
    setConstraintsLoading(true);

    const loadSchedulingConstraints = async () => {
      try {
        const result = await apiClient.interviews.getInterview(interview.id);
        if (cancelled) return;
        setSchedulingConstraints(result?.interview?.schedulingConstraints || null);
        setConstraintsError(result?.interview?.schedulingConstraintsError?.message || null);
      } catch (loadError) {
        if (cancelled) return;
        setConstraintsError(loadError?.message || 'Unable to load scheduling rules right now.');
        setSchedulingConstraints(null);
      } finally {
        if (!cancelled) {
          setConstraintsLoading(false);
        }
      }
    };

    loadSchedulingConstraints();
    return () => {
      cancelled = true;
    };
  }, [interview?.id, isHiringInterview, isOpen]);

  useEffect(() => {
    if (!isOpen || !isHiringInterview) {
      return undefined;
    }

    let cancelled = false;
    setReviewerOptionsLoading(true);
    setReviewerOptionsError(null);

    const loadReviewerOptions = async () => {
      try {
        const result = await apiClient.organizations.listMembers();
        if (cancelled) return;
        setReviewerOptions(buildReviewerAssignmentOptions(result?.members || []));
      } catch (loadError) {
        if (cancelled) return;
        setReviewerOptions([]);
        setReviewerOptionsError(loadError?.message || 'Unable to load reviewer assignments right now.');
      } finally {
        if (!cancelled) {
          setReviewerOptionsLoading(false);
        }
      }
    };

    loadReviewerOptions();
    return () => {
      cancelled = true;
    };
  }, [isHiringInterview, isOpen]);

  useEffect(() => {
    setError(null);
  }, [scheduledFor, duration, timezone, notes, schedulingStrategy]);

  const manualValidationMessage = effectiveStrategy === 'MANUAL' && !demoBypassAvailability
    ? validateManualInterviewSelection({
      scheduledFor,
      duration,
      constraints: schedulingConstraints,
      requiresAvailabilityChecks: isHiringInterview,
    })
    : null;
  const manualWindowBounds = useMemo(
    () => (isHiringInterview ? buildManualWindowBounds(schedulingConstraints) : null),
    [isHiringInterview, schedulingConstraints],
  );
  const suggestedManualSlots = useMemo(
    () => (
      effectiveStrategy === 'MANUAL'
        ? buildSuggestedManualSlots({
          constraints: schedulingConstraints,
          duration,
          requiresAvailabilityChecks: isHiringInterview,
        })
        : []
    ),
    [duration, effectiveStrategy, isHiringInterview, schedulingConstraints],
  );
  const showTimezoneTranslation = Boolean(
    schedulingConstraints?.timezone
    && schedulingConstraints.timezone !== (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'),
  );
  const manualBlockingMessage = effectiveStrategy !== 'MANUAL'
    ? null
    : (
      (isHiringInterview && constraintsLoading && !demoBypassAvailability)
        ? 'Loading assigned scheduling availability...'
        : ((demoBypassAvailability ? null : constraintsError) || manualValidationMessage)
    );
  const isSubmitDisabled = saving || Boolean(manualBlockingMessage);
  const candidateJoinAccessModalHeading = isReschedule
    ? getRecruiterMeetingLinkScheduledDescription()
    : getRecruiterMeetingLinkUnscheduledDescription();
  const candidateJoinAccessModalDetail = isReschedule
    ? getRecruiterMeetingLinkRescheduleDescription()
    : 'No manual meeting link is needed. The system handles candidate access automatically.';
  const candidateJoinAccessSuccess = isReschedule
    ? getRecruiterMeetingLinkRescheduleDescription()
    : getRecruiterMeetingLinkScheduledDescription();
  const assignedReviewerSummary = useMemo(() => {
    if (reviewerAssignments.length === 0) {
      return 'No reviewers assigned yet';
    }

    const selectedAssignees = reviewerAssignments.map((reviewerId) => {
      const option = reviewerOptions.find((candidate) => candidate.value === reviewerId);
      if (option) {
        return { fullName: option.label };
      }
      return (interview?.reviewerAssignees || []).find((reviewer) => reviewer?.id === reviewerId) || null;
    });

    return summarizeReviewerAssignees(selectedAssignees);
  }, [interview?.reviewerAssignees, reviewerAssignments, reviewerOptions]);

  const toggleReviewerAssignment = (reviewerId) => {
    setReviewerAssignments((previous) => (
      previous.includes(reviewerId)
        ? previous.filter((value) => value !== reviewerId)
        : [...previous, reviewerId]
    ));
  };

  const applyDemoBypassSlot = () => {
    setSchedulingStrategy('MANUAL');
    setScheduledFor(demoBypassDatetime());
    setDemoBypassAvailability(true);
    setError(null);
    setNotes((previous) => {
      const current = previous || '';
      const marker = 'Temporary demo scheduling bypass used.';
      return current.includes(marker) ? current : `${current}${current ? '\n' : ''}${marker}`;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (manualBlockingMessage) {
      setError(manualBlockingMessage);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        strategy: effectiveStrategy,
        duration,
        timezone: timezone?.trim() || 'UTC',
        notes,
        reviewerAssignments,
        ...(demoBypassAvailability ? { demoBypassAvailability: true } : {}),
      };
      if (effectiveStrategy === 'MANUAL') {
        const normalizedDate = new Date(scheduledFor);
        if (Number.isNaN(normalizedDate.getTime())) {
          throw new Error('Select a valid interview date and time.');
        }
        if (normalizedDate.getTime() <= Date.now()) {
          throw new Error('Interview date and time must be in the future.');
        }
        payload.scheduledFor = normalizedDate.toISOString();
      }
      if (isReschedule && pendingRescheduleRequest?.id) {
        payload.rescheduleRequestId = pendingRescheduleRequest.id;
      }
      let result;
      if (isReschedule) {
        result = await apiClient.interviews.reschedule(interview.id, payload);
      } else {
        result = await apiClient.interviews.schedule(interview.id, payload);
      }
      onScheduled?.();

      const decision = result?.interview?.scheduleDecision;
      const reasonText = buildSlotReasonText(decision);
      if (reasonText && effectiveStrategy !== 'MANUAL') {
        setSuccessInfo({
          scheduledFor: result?.interview?.scheduledFor,
          reasonText,
          source: decision?.source,
        });
      } else {
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to schedule interview');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 backdrop-blur-sm sm:p-6"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            className="max-h-[calc(100vh-1.5rem)] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-800 sm:max-h-[calc(100vh-3rem)] sm:p-6"
          >
            {successInfo ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <Icon name="CalendarCheck" size={18} color="white" />
                  </div>
                  <div>
                    <h2 id={modalTitleId} className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      {isReschedule ? 'Interview Rescheduled' : 'Interview Scheduled'}
                    </h2>
                    {successInfo.scheduledFor && (
                      <p className="text-sm text-gray-600 dark:text-slate-300">
                        {formatSlotDate(successInfo.scheduledFor)}
                      </p>
                    )}
                  </div>
                </div>

                <div className={`rounded-xl border p-3 space-y-1.5 ${
                  successInfo.source === 'PREFERRED_SLOT'
                    ? 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10'
                    : 'border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10'
                }`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                    Why this slot was selected
                  </p>
                  {successInfo.reasonText.split('\n').map((line, i) => (
                    <p
                      key={i}
                      className={`text-sm ${
                        i === 0
                          ? (successInfo.source === 'PREFERRED_SLOT'
                            ? 'text-emerald-800 dark:text-emerald-100'
                            : 'text-blue-800 dark:text-blue-100')
                          : 'text-gray-500 dark:text-slate-400 text-xs pl-2'
                      }`}
                    >
                      {i === 0 ? (
                        <span className="flex items-center gap-1.5">
                          <Icon
                            name={successInfo.source === 'PREFERRED_SLOT' ? 'UserCheck' : 'Zap'}
                            size={14}
                          />
                          {line}
                        </span>
                      ) : (
                        <span>&bull; {line}</span>
                      )}
                    </p>
                  ))}
                </div>

                {isHiringInterview && (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                      Candidate join access
                    </p>
                    <p className="text-sm text-blue-900 dark:text-blue-100">
                      {candidateJoinAccessSuccess}
                    </p>
                  </div>
                )}

                <Button variant="primary" className="w-full" onClick={onClose}>
                  Done
                </Button>
              </div>
            ) : (
            <>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Icon name="CalendarPlus" size={18} color="white" />
                </div>
                <div>
                  <h2 id={modalTitleId} className="text-lg font-bold text-gray-900 dark:text-slate-100">
                    {isReschedule ? 'Reschedule Interview' : 'Schedule Interview'}
                  </h2>
                  {interview?.candidate?.fullName && (
                    <p className="text-xs text-gray-500 dark:text-slate-400">{interview.candidate.fullName}</p>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <Icon name="X" size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {pendingRescheduleRequest && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                    Candidate reschedule request
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-100">
                    {pendingRescheduleRequest.reason || 'Candidate requested a new interview slot.'}
                  </p>
                </div>
              )}

              {isHiringInterview && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Scheduling mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSchedulingStrategy(autoStrategyValue);
                        setDemoBypassAvailability(false);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        effectiveStrategy !== 'MANUAL'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                      }`}
                    >
                      <p className="font-semibold">Auto assign slot</p>
                      <p className="text-xs opacity-90 mt-1">
                        {pendingRescheduleRequest
                          ? 'Use preferred slots first, then earliest valid slot.'
                          : 'Pick earliest valid slot from interviewer availability.'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSchedulingStrategy('MANUAL');
                        setDemoBypassAvailability(false);
                      }}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                        effectiveStrategy === 'MANUAL'
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300'
                      }`}
                    >
                      <p className="font-semibold">Pick manually</p>
                      <p className="text-xs opacity-90 mt-1">Choose exact date and time now.</p>
                    </button>
                  </div>
                  <div className="rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10 p-3 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <Icon name="Mail" size={14} className="mt-0.5 text-blue-700 dark:text-blue-200" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700 dark:text-blue-200">
                          Candidate join access
                        </p>
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          {candidateJoinAccessModalHeading}
                        </p>
                        <p className="text-xs text-blue-700/85 dark:text-blue-200/85">
                          {candidateJoinAccessModalDetail}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Icon name="FastForward" size={14} className="mt-0.5 text-amber-700 dark:text-amber-200" />
                      <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-amber-700 dark:text-amber-200">
                          Temporary demo bypass
                        </p>
                        <p className="text-xs text-amber-800 dark:text-amber-100">
                          Schedules this interview about two minutes from now and skips lead time,
                          working-day, business-hour, and conflict checks for this save only.
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      iconName="FastForward"
                      onClick={applyDemoBypassSlot}
                      className="w-full border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-100 dark:hover:bg-amber-500/20"
                    >
                      Use Demo Time Now
                    </Button>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                          Reviewer coverage
                        </p>
                        <p className="text-sm text-gray-800 dark:text-slate-100">
                          Choose who should evaluate this interview after it completes.
                        </p>
                      </div>
                      <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded-full border border-gray-200 dark:border-slate-600 px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-slate-300">
                        {reviewerAssignments.length} assigned
                      </span>
                    </div>
                    {(reviewerAssignments.length > 0 || (interview?.reviewerAssignees || []).length > 0) && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Current assignees: <span className="break-words">{assignedReviewerSummary}</span>
                      </p>
                    )}
                    {reviewerOptionsLoading ? (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        Loading review-capable team members...
                      </p>
                    ) : reviewerOptionsError ? (
                      <p className="text-xs text-rose-600 dark:text-rose-300">
                        {reviewerOptionsError}
                      </p>
                    ) : reviewerOptions.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        No active review-capable team members are available to assign yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {reviewerOptions.map((option) => {
                          const isSelected = reviewerAssignments.includes(option.value);
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => toggleReviewerAssignment(option.value)}
                              className={`min-h-[6.25rem] rounded-lg border px-3 py-3 text-left transition-colors ${
                                isSelected
                                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
                                  : 'border-gray-200 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:border-emerald-300 dark:hover:border-emerald-500/60'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                                  isSelected
                                    ? 'border-emerald-500 bg-emerald-500 text-white dark:border-emerald-400 dark:bg-emerald-500'
                                    : 'border-gray-300 text-transparent dark:border-slate-500'
                                }`}>
                                  <Icon
                                    name={isSelected ? 'Check' : 'Circle'}
                                    size={12}
                                  />
                                </span>
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="break-words text-sm font-semibold leading-snug">{option.label}</p>
                                  {option.roleLabel && (
                                    <p className="truncate text-[11px] leading-tight opacity-80">{option.roleLabel}</p>
                                  )}
                                  {option.email && (
                                    <p
                                      className="max-w-full truncate text-[11px] leading-tight opacity-80"
                                      title={option.email}
                                    >
                                      {option.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {effectiveStrategy === 'MANUAL' ? (
                <div className="space-y-3">
                  {isHiringInterview && (
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 p-3 space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                        Manual scheduling checks
                      </p>
                      {schedulingConstraints ? (
                        <>
                          <p className="text-sm font-medium text-gray-800 dark:text-slate-100">
                            {getAvailabilitySourceLabel(schedulingConstraints)}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-slate-400">
                            {formatWorkingDays(schedulingConstraints.workingDays)} | {' '}
                            {formatMinutesOfDay(schedulingConstraints.businessHoursStartMinutes)}-
                            {formatMinutesOfDay(schedulingConstraints.businessHoursEndMinutes)} {' '}
                            {schedulingConstraints.timezone || 'UTC'}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-slate-500">
                            Lead time: {schedulingConstraints.leadHours}h | Window: {schedulingConstraints.scheduleWindowDays} days
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-gray-600 dark:text-slate-400">
                          {constraintsLoading
                            ? 'Loading assigned scheduling availability...'
                            : (constraintsError || 'Scheduling rules are unavailable right now.')}
                        </p>
                      )}
                      {demoBypassAvailability && (
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-200">
                          Demo bypass is active. This save will skip availability checks while still requiring a future time.
                        </p>
                      )}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="schedule-interview-datetime"
                      className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5"
                    >
                      Date & Time
                    </label>
                    <input
                      id="schedule-interview-datetime"
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                      min={
                        demoBypassAvailability
                          ? minimumDatetime()
                          : manualWindowBounds?.minimumDate
                          ? toLocalDatetimeValue(manualWindowBounds.minimumDate)
                          : minimumDatetime()
                      }
                      max={
                        demoBypassAvailability
                          ? undefined
                          : manualWindowBounds?.maximumDate
                          ? toLocalDatetimeValue(manualWindowBounds.maximumDate)
                          : undefined
                      }
                      step={demoBypassAvailability ? 60 : Math.max(1, Number(manualWindowBounds?.slotMinutes) || 30) * 60}
                      required
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700/50 dark:text-slate-100 dark:[color-scheme:dark]"
                    />
                    {isHiringInterview && schedulingConstraints && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                        Lead time, scheduling window, working days, and business hours are applied here.
                        Final conflict checks still run when you save.
                      </p>
                    )}
                    {isHiringInterview && schedulingConstraints && !constraintsLoading && (
                      <div className="mt-3 space-y-2">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                            Next valid slots
                          </p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500 sm:text-right">
                            Based on {getAvailabilitySourceLabel(schedulingConstraints).toLowerCase()}
                          </p>
                        </div>
                        {suggestedManualSlots.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {suggestedManualSlots.map((slot) => {
                              const isSelected = slot.value === scheduledFor;
                              return (
                                <button
                                  key={slot.value}
                                  type="button"
                                  onClick={() => setScheduledFor(slot.value)}
                                  aria-label={`Use suggested slot ${slot.localLabel}`}
                                  className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                                    isSelected
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-200'
                                      : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600 text-gray-700 dark:text-slate-200'
                                  }`}
                                >
                                  <p className="text-sm font-medium">{slot.localLabel}</p>
                                  {showTimezoneTranslation && (
                                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                                      {slot.availabilityLabel} {schedulingConstraints.timezone}
                                    </p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 dark:text-slate-400">
                            No guided slots are available inside the current availability window.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Slot will be assigned from configured working days, business hours, and conflict checks.
                </p>
              )}

              <div>
                <div className="sm:max-w-sm">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Timezone
                  </label>
                  <input
                    type="text"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Duration
                </label>
                <div className="flex flex-wrap gap-2">
                  {DURATION_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDuration(opt.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        duration === opt.value
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                  Notes <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any instructions or notes for the candidate..."
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {error}
                </p>
              )}
              {!error && manualBlockingMessage && (
                <p className="text-sm text-amber-600 dark:text-amber-300 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {manualBlockingMessage}
                </p>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={saving} disabled={isSubmitDisabled}>
                  {isReschedule ? 'Reschedule' : 'Schedule'}
                </Button>
              </div>
            </form>
            </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ScheduleInterviewModal;
