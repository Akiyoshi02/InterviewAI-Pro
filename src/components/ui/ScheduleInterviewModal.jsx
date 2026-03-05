import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../AppIcon';
import Button from './Button';
import apiClient from '../../services/apiClient.js';

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

const toLocalDatetimeValue = (d) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const defaultDatetime = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 60 - (d.getMinutes() % 30));
  d.setSeconds(0);
  d.setMilliseconds(0);
  return toLocalDatetimeValue(d);
};

const ScheduleInterviewModal = ({ interview, isOpen, onClose, onScheduled }) => {
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
  }, [interview, isOpen, pendingRescheduleRequest]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        strategy: effectiveStrategy,
        duration,
        timezone: timezone?.trim() || 'UTC',
        notes,
      };
      if (effectiveStrategy === 'MANUAL') {
        const normalizedDate = new Date(scheduledFor);
        if (Number.isNaN(normalizedDate.getTime())) {
          throw new Error('Select a valid interview date and time.');
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl max-w-md w-full p-6"
          >
            {successInfo ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                    <Icon name="CalendarCheck" size={18} color="white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
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
                  <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">
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
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">
                    Scheduling mode
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSchedulingStrategy(autoStrategyValue)}
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
                      onClick={() => setSchedulingStrategy('MANUAL')}
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
                </div>
              )}

              {effectiveStrategy === 'MANUAL' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    min={toLocalDatetimeValue(new Date())}
                    required
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700/50 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  Slot will be assigned from configured working days, business hours, and conflict checks.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
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

              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" className="flex-1" loading={saving}>
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
