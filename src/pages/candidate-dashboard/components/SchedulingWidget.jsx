import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import AppImage from '../../../components/AppImage';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import apiClient from '../../../services/apiClient';
import {
  getCandidateMeetingLinkEmailNotice,
} from '../../../constants/interviewMeetingLink.js';
import { getInterviewRoundSummary } from '../../../utils/interviewRoundSummary.js';
import {
  getInterviewAccessWindow,
  isCandidateInterviewStillRelevant,
  isInterviewAccessWindowOpen,
} from '../../../utils/candidateInterviewWindows.js';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

const decodeHtmlEntities = (value) => {
  if (typeof value !== 'string') return value || '';
  if (!value.includes('&')) return value;
  if (typeof document === 'undefined') return value;
  const decoder = document.createElement('textarea');
  decoder.innerHTML = value;
  return decoder.value;
};

const resolveInterviewOrganizationName = (interview) => (
  interview?.organization?.displayName
  || interview?.organization?.name
  || interview?.company?.companyName
  || interview?.company?.fullName
  || interview?.company?.displayName
  || (typeof interview?.company === 'string' ? interview.company : null)
  || 'Interview Session'
);

const resolveInterviewOrganizationLogo = (interview) => (
  interview?.organization?.logo
  || interview?.company?.logo
  || interview?.company?.logoUrl
  || interview?.company?.companyLogoUrl
  || null
);

const formatDuration = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) return `${parsed} min`;
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '45 min';
};

const SchedulingWidget = ({ upcomingInterviews = [], onScheduleSaved }) => {
  const navigate = useNavigate();
  const [currentTimestamp, setCurrentTimestamp] = useState(() => Date.now());
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [formMode, setFormMode] = useState('manage');
  const [selectedInterviewId, setSelectedInterviewId] = useState('');
  const [scheduledFor, setScheduledFor] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [preferredRescheduleSlot, setPreferredRescheduleSlot] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSent, setContactSent] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState('');

  const isCandidateManageableInterview = (interview) => {
    const mode = String(interview?.mode || interview?.interviewMode || '').toUpperCase();
    return mode === 'PRACTICE';
  };

  const getPendingRescheduleRequest = (interview) => {
    if (!interview) return null;
    if (interview.pendingRescheduleRequest) return interview.pendingRescheduleRequest;
    if (!Array.isArray(interview.rescheduleRequests)) return null;
    for (let index = interview.rescheduleRequests.length - 1; index >= 0; index -= 1) {
      const request = interview.rescheduleRequests[index];
      if ((request?.status || '').toUpperCase() === 'PENDING') {
        return request;
      }
    }
    return null;
  };

  const hasExhaustedRescheduleRequests = (interview) => {
    if (!Array.isArray(interview?.rescheduleRequests)) return false;
    return interview.rescheduleRequests.length >= 1;
  };

  const canCandidateRequestReschedule = (interview) => {
    const mode = String(interview?.mode || interview?.interviewMode || '').toUpperCase();
    if (mode !== 'HIRING') return false;
    const status = String(interview?.status || '').toUpperCase();
    if (status !== 'SCHEDULED') return false;
    if (!interview?.scheduledFor) return false;
    if (getPendingRescheduleRequest(interview)) return false;
    if (hasExhaustedRescheduleRequests(interview)) return false;
    return true;
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTimestamp(Date.now());
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Transform real interview data into the display format
  const transformInterviews = (interviews) => {
    if (!Array.isArray(interviews)) return [];
    
    // Filter for scheduled/upcoming interviews and transform
    return interviews
      .filter(interview => {
        const status = interview?.status?.toUpperCase();
        if (status !== 'SCHEDULED' && status !== 'IN_PROGRESS' && status !== 'PAUSED') {
          return false;
        }

        return isCandidateInterviewStillRelevant(interview, currentTimestamp);
      })
      .map(interview => {
        const companyNameRaw = resolveInterviewOrganizationName(interview);
        const companyName = decodeHtmlEntities(companyNameRaw);
        const companyLogoRaw = resolveInterviewOrganizationLogo(interview);
        const companyLogo = companyLogoRaw
          ? (companyLogoRaw.startsWith('http') ? companyLogoRaw : `${API_BASE}${companyLogoRaw.startsWith('/') ? '' : '/'}${companyLogoRaw}`)
          : null;
        const scheduledDate = interview?.scheduledFor ? new Date(interview.scheduledFor) : null;
        const scheduledTimestamp = scheduledDate && !Number.isNaN(scheduledDate.getTime())
          ? scheduledDate.getTime()
          : Number.MAX_SAFE_INTEGER;
        const pendingRescheduleRequest = getPendingRescheduleRequest(interview);
        const canManageSchedule = isCandidateManageableInterview(interview);
        const canRequestReschedule = canCandidateRequestReschedule(interview);
        const rescheduleExhausted = !canRequestReschedule && !pendingRescheduleRequest && hasExhaustedRescheduleRequests(interview);
        const hasScheduledDate = Boolean(scheduledDate && !Number.isNaN(scheduledDate.getTime()));
        const rawStatus = String(interview?.status || '').toUpperCase();
        const canDirectJoinHiringInterview = (
          String(interview?.mode || interview?.interviewMode || '').toUpperCase() === 'HIRING'
          && hasScheduledDate
          && isInterviewAccessWindowOpen(interview, currentTimestamp)
          && (rawStatus === 'SCHEDULED' || rawStatus === 'IN_PROGRESS' || rawStatus === 'PAUSED')
        );

        // Calculate time left
        let timeLeft = '';
        if (scheduledDate) {
          const now = new Date();
          const diffMs = scheduledDate - now;
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) {
            timeLeft = 'Today';
          } else if (diffDays === 1) {
            timeLeft = '1 day';
          } else {
            timeLeft = `${diffDays} days`;
          }
        }
        
        return {
          id: interview?.id,
          mode: String(interview?.mode || interview?.interviewMode || '').toUpperCase(),
          company: companyName,
          companyLogo: companyLogo,
          companyLogoAlt: `${companyName} logo`,
          position: decodeHtmlEntities(interview?.jobRole || interview?.position || 'Interview'),
          date: hasScheduledDate ? scheduledDate.toLocaleDateString() : 'Scheduling pending',
          time: hasScheduledDate ? scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '',
          duration: formatDuration(interview?.duration),
          type: decodeHtmlEntities(interview?.interviewType || interview?.type || 'Interview'),
          interviewer: interview?.interviewer?.name || interview?.interviewerName || null,
          interviewerAvatar: interview?.interviewer?.avatar || null,
          status: ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'].includes(rawStatus) ? 'confirmed' : 'pending',
          timeLeft,
          hasScheduledDate,
          scheduledForRaw: interview?.scheduledFor || null,
          scheduledTimestamp,
          canDirectJoinHiringInterview,
          canManageSchedule,
          canRequestReschedule,
          pendingRescheduleRequest,
          rescheduleExhausted,
          roundSummary: getInterviewRoundSummary(interview),
        };
      })
      .sort((a, b) => {
        // Sort by datetime, earliest first
        const dateA = a?.scheduledTimestamp || Number.MAX_SAFE_INTEGER;
        const dateB = b?.scheduledTimestamp || Number.MAX_SAFE_INTEGER;
        return dateA - dateB;
      });
  };

  // Use transformed real data - no mock fallback
  const interviewData = useMemo(
    () => transformInterviews(upcomingInterviews),
    [currentTimestamp, upcomingInterviews],
  );
  const scheduledInterviewCount = interviewData.filter((interview) => interview?.hasScheduledDate).length;
  const pendingSchedulingCount = interviewData.length - scheduledInterviewCount;
  const manageableInterviews = interviewData.filter((interview) => interview?.canManageSchedule);
  const requestableInterviews = interviewData.filter((interview) => interview?.canRequestReschedule);
  const hasScheduledInterviews = interviewData.length > 0;
  const hasManageableInterviews = manageableInterviews.length > 0;
  const hasRequestableInterviews = requestableInterviews.length > 0;

  const getStatusColor = (status) => {
    const colorMap = {
      confirmed: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50/90 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/30',
      pending: 'text-purple-600 dark:text-purple-400 bg-purple-50/90 dark:bg-purple-500/10 border-purple-100 dark:border-purple-500/30',
      cancelled: 'text-rose-600 dark:text-rose-400 bg-rose-50/90 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/30'
    };
    return (
      colorMap?.[status] ||
      'text-gray-600 dark:text-slate-300 bg-white/70 dark:bg-slate-800/70 border-white/30 dark:border-slate-700/60'
    );
  };

  const getCountdownColor = (timeLeft) => {
    if (!timeLeft || timeLeft === 'Today') return 'text-rose-500 dark:text-rose-400';
    const days = parseInt(timeLeft, 10);
    if (Number.isNaN(days) || days <= 1) return 'text-rose-500 dark:text-rose-400';
    if (days <= 3) return 'text-purple-600 dark:text-purple-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const toDateTimeLocal = (isoValue) => {
    if (!isoValue) return '';
    const date = new Date(isoValue);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const getMinimumDateTimeLocal = () => {
    const date = new Date();
    date.setSeconds(0, 0);
    date.setMinutes(date.getMinutes() + 1);
    return toDateTimeLocal(date);
  };

  const resetScheduleForm = () => {
    setFormMode('manage');
    setSelectedInterviewId('');
    setScheduledFor('');
    setRescheduleReason('');
    setPreferredRescheduleSlot('');
    setContactMessage('');
    setContactSent(false);
    setScheduleError('');
  };

  useEffect(() => {
    const current = interviewData.find((item) => item.id === selectedInterviewId);
    if (!current) return;
    if (formMode === 'manage') {
      setScheduledFor(toDateTimeLocal(current?.scheduledForRaw));
      return;
    }
    setScheduledFor(toDateTimeLocal(current?.scheduledForRaw));
  }, [formMode, interviewData, selectedInterviewId]);

  useEffect(() => {
    if (!showScheduleForm || typeof document === 'undefined') return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showScheduleForm]);

  const openScheduleFormFor = (interview = null) => {
    const target = interview || manageableInterviews?.[0] || requestableInterviews?.[0] || null;
    if (!target) {
      navigate('/my-applications');
      return;
    }
    if (target?.canManageSchedule) {
      setFormMode('manage');
      setSelectedInterviewId(target.id || '');
      setScheduledFor(toDateTimeLocal(target?.scheduledForRaw));
      setRescheduleReason('');
      setPreferredRescheduleSlot('');
      setShowScheduleForm(true);
      setScheduleError('');
      return;
    }
    if (target?.canRequestReschedule) {
      setFormMode('request');
      setSelectedInterviewId(target.id || '');
      setScheduledFor(toDateTimeLocal(target?.scheduledForRaw));
      setRescheduleReason('');
      setPreferredRescheduleSlot('');
      setShowScheduleForm(true);
      setScheduleError('');
      return;
    }
    if (target?.rescheduleExhausted) {
      setFormMode('contact');
      setSelectedInterviewId(target.id || '');
      setContactMessage('');
      setContactSent(false);
      setShowScheduleForm(true);
      setScheduleError('');
      return;
    }
    setScheduleError('This interview cannot be rescheduled from your dashboard right now.');
    setShowScheduleForm(false);
  };

  const handleScheduleSubmit = async () => {
    try {
      setScheduleError('');
      if (!selectedInterviewId) {
        setScheduleError('Select an interview first.');
        return;
      }
      if (formMode === 'contact') {
        if ((contactMessage || '').trim().length < 10) {
          setScheduleError('Please provide at least 10 characters for your message.');
          return;
        }
        setSavingSchedule(true);
        await apiClient.interviews.contactCompany(selectedInterviewId, {
          message: contactMessage.trim(),
        });
        setContactSent(true);
        return;
      }
      if (formMode !== 'request' && !scheduledFor) {
        setScheduleError('Select date and time.');
        return;
      }
      const current = interviewData.find((item) => item.id === selectedInterviewId);
      setSavingSchedule(true);
      if (formMode === 'request') {
        if (!current?.canRequestReschedule) {
          setScheduleError('This interview is not eligible for reschedule requests.');
          return;
        }
        if ((rescheduleReason || '').trim().length < 20) {
          setScheduleError('Please provide at least 20 characters for the reschedule reason.');
          return;
        }
        const preferredDate = preferredRescheduleSlot ? new Date(preferredRescheduleSlot) : null;
        if (
          preferredRescheduleSlot
          && (
            !preferredDate
            || Number.isNaN(preferredDate.getTime())
            || preferredDate.getTime() <= Date.now()
          )
        ) {
          setScheduleError('Preferred reschedule slot must be in the future.');
          return;
        }
        const payload = {
          reason: rescheduleReason.trim(),
          preferredSlots: preferredRescheduleSlot
            ? [preferredDate.toISOString()]
            : [],
          timezone,
        };
        await apiClient.interviews.requestReschedule(selectedInterviewId, payload);
      } else {
        if (!current?.canManageSchedule) {
          setScheduleError('Only practice interviews can be directly rescheduled from this dashboard.');
          return;
        }
        const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
        if (!scheduledDate || Number.isNaN(scheduledDate.getTime())) {
          setScheduleError('Select a valid date and time.');
          return;
        }
        if (scheduledDate.getTime() <= Date.now()) {
          setScheduleError('Interview date and time must be in the future.');
          return;
        }
        const payload = {
          scheduledFor: scheduledDate.toISOString(),
          timezone,
        };
        if (current?.scheduledForRaw) {
          await apiClient.interviews.reschedule(selectedInterviewId, payload);
        } else {
          await apiClient.interviews.schedule(selectedInterviewId, payload);
        }
      }
      setShowScheduleForm(false);
      resetScheduleForm();
      if (typeof onScheduleSaved === 'function') {
        await onScheduleSaved();
      }
    } catch (error) {
      setScheduleError(error?.message || 'Failed to save schedule');
    } finally {
      setSavingSchedule(false);
    }
  };



  const closeScheduleForm = () => {
    setShowScheduleForm(false);
    resetScheduleForm();
  };

  const scheduleFormOptions = formMode === 'request' ? requestableInterviews : manageableInterviews;
  const selectedInterview = interviewData.find((item) => item.id === selectedInterviewId) || null;
  const scheduleModal = showScheduleForm && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4">
        <div
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
          onClick={closeScheduleForm}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-2xl rounded-2xl border border-white/30 dark:border-slate-700/60 bg-white/95 dark:bg-slate-900/95 shadow-[0_30px_90px_rgba(15,23,42,0.45)]"
        >
          <div className="px-4 sm:px-5 py-3 border-b border-white/40 dark:border-slate-700/60 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                {formMode === 'contact' ? 'Contact Hiring Team' : formMode === 'request' ? 'Request Reschedule' : 'Manage Schedule'}
              </h3>
              {selectedInterview && (
                <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {selectedInterview.company} - {selectedInterview.position}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeScheduleForm}
              className="rounded-lg p-1.5 text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200"
              aria-label="Close schedule form"
            >
              <Icon name="X" size={16} />
            </button>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {formMode === 'contact' ? (
              contactSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mx-auto">
                    <Icon name="CheckCircle" size={24} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-slate-100">Message sent</p>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                      The hiring team will be notified and can follow up with you directly.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                      You&apos;ve already used your reschedule request for this interview. Send a message to the hiring team to discuss further scheduling changes.
                    </p>
                  </div>
                  <textarea
                    value={contactMessage}
                    onChange={(event) => setContactMessage(event.target.value)}
                    rows={4}
                    placeholder="Explain what you'd like to discuss about the interview schedule (minimum 10 characters)"
                    className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  />
                </>
              )
            ) : (
            <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={selectedInterviewId}
                onChange={(event) => setSelectedInterviewId(event.target.value)}
                className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
              >
                <option value="">Select interview</option>
                {scheduleFormOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company} - {item.position}
                  </option>
                ))}
              </select>
              {formMode === 'request' ? (
                <input
                  type="datetime-local"
                  value={preferredRescheduleSlot}
                  onChange={(event) => setPreferredRescheduleSlot(event.target.value)}
                  min={getMinimumDateTimeLocal()}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                  placeholder="Preferred new slot (optional)"
                />
              ) : (
                <input
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(event) => setScheduledFor(event.target.value)}
                  min={getMinimumDateTimeLocal()}
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              )}
            </div>

            {formMode === 'request' ? (
              <>
                <textarea
                  value={rescheduleReason}
                  onChange={(event) => setRescheduleReason(event.target.value)}
                  rows={3}
                  placeholder="Explain why you need to reschedule (minimum 20 characters)"
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Timezone (IANA)"
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={timezone}
                  onChange={(event) => setTimezone(event.target.value)}
                  placeholder="Timezone (IANA)"
                  className="w-full rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
                />
              </div>
            )}
            </>
            )}

            {scheduleError && <p className="text-xs text-rose-600 dark:text-rose-400">{scheduleError}</p>}
          </div>

          <div className="px-4 sm:px-5 py-3 border-t border-white/40 dark:border-slate-700/60 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={closeScheduleForm}
            >
              {contactSent ? 'Close' : 'Cancel'}
            </Button>
            {!contactSent && (
            <Button
              variant="default"
              size="sm"
              onClick={handleScheduleSubmit}
              disabled={savingSchedule}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white"
            >
              {savingSchedule
                ? 'Sending...'
                : (formMode === 'contact' ? 'Send Message' : formMode === 'request' ? 'Submit Request' : 'Save Schedule')}
            </Button>
            )}
          </div>
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div className="rounded-2xl border border-white/30 dark:border-slate-700/50 bg-white/80 dark:bg-slate-800/80 shadow-[0_20px_60px_rgba(15,23,42,0.12)] dark:shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 sm:pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25 flex-shrink-0">
              <Icon name="CalendarCheck" size={17} color="white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-slate-100">
                  {pendingSchedulingCount > 0 && scheduledInterviewCount === 0 ? 'Interview Workflow' : 'Upcoming Interviews'}
                </h2>
                {interviewData?.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 tabular-nums">
                    {interviewData.length}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-400 leading-relaxed">
                {scheduledInterviewCount > 0 && pendingSchedulingCount > 0
                  ? `Track ${scheduledInterviewCount} scheduled and ${pendingSchedulingCount} pending interview workflows`
                  : scheduledInterviewCount > 0
                    ? 'Manage your scheduled interviews'
                    : pendingSchedulingCount > 0
                      ? 'Track interview workflows that are waiting for scheduling details'
                      : 'Manage your scheduled interviews'}
              </p>
            </div>
          </div>
          {(hasManageableInterviews || hasRequestableInterviews) && (
            <Button
              variant="default"
              size="sm"
              iconName="Settings2"
              iconPosition="left"
              onClick={() => openScheduleFormFor()}
              className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 w-full sm:w-auto"
            >
              Manage Schedule
            </Button>
          )}
        </div>

        {/* Interview Cards */}
        {interviewData?.length > 0 ? (
        <div className="px-4 sm:px-5 pb-1 space-y-3">
            {interviewData?.map((interview, index) => {
              const isToday = interview?.timeLeft === 'Today';
              const isUrgent = isToday || (parseInt(interview?.timeLeft, 10) === 1);
              const showLiveNowState = Boolean(interview?.canDirectJoinHiringInterview);
              return (
          <div
            key={interview?.id}
            className={`group relative rounded-xl border transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.35)] ${
              isUrgent
                ? 'border-blue-200/80 dark:border-blue-500/30 bg-gradient-to-r from-blue-50/60 via-white/80 to-white/80 dark:from-blue-950/30 dark:via-slate-800/80 dark:to-slate-800/80'
                : 'border-white/40 dark:border-slate-700/50 bg-white/70 dark:bg-slate-800/70'
            }`}
          >
                {/* Accent bar */}
                <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
                  isUrgent
                    ? 'bg-gradient-to-b from-blue-500 to-purple-500'
                    : 'bg-gradient-to-b from-blue-400/60 to-purple-400/60 dark:from-blue-500/40 dark:to-purple-500/40'
                }`} />

                <div className="p-3.5 sm:p-4 pl-5 sm:pl-6">
                  {/* Top row: company info + status */}
                  <div className="flex items-center gap-3.5 mb-3">
                {interview?.companyLogo ? (
                  <AppImage
                    src={interview.companyLogo}
                    alt={interview?.companyLogoAlt}
                    className="w-16 h-16 rounded-full object-contain bg-white dark:bg-slate-700/60 flex-shrink-0 ring-1 ring-white/60 dark:ring-slate-700/60 shadow-sm p-1"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 flex-shrink-0 flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Icon name="Building2" size={24} color="white" />
                  </div>
                )}

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-sm sm:text-[15px] truncate leading-snug">{interview?.company}</h3>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 truncate leading-relaxed mt-0.5">{interview?.position}</p>
                      {interview?.roundSummary && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center rounded-full border border-violet-200/80 dark:border-violet-500/30 bg-violet-50/80 dark:bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-700 dark:text-violet-200">
                            {interview.roundSummary.badge}
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate">
                            {interview.roundSummary.title}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {showLiveNowState && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/80 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700 dark:text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Live Now
                        </span>
                      )}
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border whitespace-nowrap ${getStatusColor(interview?.status)}`}>
                        {interview?.status ? `${interview.status.charAt(0).toUpperCase()}${interview.status.slice(1)}` : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Metadata chips row */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mb-3">
                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                      <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                        <Icon name="Calendar" size={12} className="text-gray-500 dark:text-slate-400" />
                      </div>
                      <span className="font-medium text-gray-700 dark:text-slate-200">{interview?.date}</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                      <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                        <Icon name="Clock" size={12} className="text-gray-500 dark:text-slate-400" />
                      </div>
                      <span className="font-medium text-gray-700 dark:text-slate-200">
                        {interview?.hasScheduledDate
                          ? `${interview?.time} (${interview?.duration})`
                          : `Duration: ${interview?.duration}`}
                      </span>
                    </div>
                    {interview?.interviewer && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                        <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                          <Icon name="User" size={12} className="text-gray-500 dark:text-slate-400" />
                        </div>
                        <span className="font-medium text-gray-700 dark:text-slate-200">{interview?.interviewer}</span>
                      </div>
                    )}
                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300">
                      <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0">
                        <Icon name="Tag" size={12} className="text-gray-500 dark:text-slate-400" />
                      </div>
                      <span className="font-medium text-gray-700 dark:text-slate-200">{interview?.type}</span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    {/* Countdown */}
                    {interview?.hasScheduledDate ? (
                      <div className={`inline-flex self-start items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg sm:self-auto ${
                        isToday
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-200/60 dark:ring-rose-500/20'
                          : isUrgent
                            ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-200/60 dark:ring-amber-500/20'
                            : `bg-white/80 dark:bg-slate-700/40 ring-1 ring-gray-200/60 dark:ring-slate-600/40 ${getCountdownColor(interview?.timeLeft)}`
                      }`}>
                        <Icon name="Timer" size={13} />
                        {isToday ? 'Today — Get ready!' : `${interview?.timeLeft} remaining`}
                      </div>
                    ) : (
                      <div className="inline-flex self-start items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-300 ring-1 ring-amber-200/60 dark:ring-amber-500/20 sm:self-auto">
                        <Icon name="Clock3" size={13} />
                        Scheduling details will be shared soon
                      </div>
                    )}

                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
	                      {interview?.canManageSchedule ? (
	                        <Button
	                          variant="outline"
	                          size="sm"
	                          iconName="Calendar"
	                          iconPosition="left"
	                          onClick={() => openScheduleFormFor(interview)}
                            className="w-full rounded-full border border-gray-200/80 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-500/5 text-xs transition-colors sm:w-auto sm:flex-none"
	                        >
	                          Reschedule
	                        </Button>
	                      ) : interview?.canRequestReschedule ? (
	                        <Button
	                          variant="outline"
	                          size="sm"
	                          iconName="MessageSquare"
	                          iconPosition="left"
	                          onClick={() => openScheduleFormFor(interview)}
                            className="w-full rounded-full border border-amber-200/80 dark:border-amber-500/30 text-amber-700 dark:text-amber-200 hover:border-amber-300 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 text-xs transition-colors sm:w-auto sm:flex-none"
	                        >
	                          Request Reschedule
	                        </Button>
	                      ) : interview?.rescheduleExhausted ? (
                        <Button
                          variant="outline"
                          size="sm"
                          iconName="Mail"
                          iconPosition="left"
                          onClick={() => openScheduleFormFor(interview)}
                          className="w-full rounded-full border border-amber-200/80 dark:border-amber-500/30 text-amber-700 dark:text-amber-200 hover:border-amber-300 dark:hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-500/5 text-xs transition-colors sm:w-auto sm:flex-none"
                        >
                          Contact Company
                        </Button>
	                      ) : (
	                        <span className="inline-flex w-full items-center justify-center rounded-full border border-gray-200 dark:border-slate-700 px-2.5 py-1 text-[11px] text-center text-gray-500 dark:text-slate-400 bg-white/60 dark:bg-slate-800/60 whitespace-normal leading-relaxed sm:w-auto sm:justify-start sm:text-left">
	                          {interview?.pendingRescheduleRequest ? 'Request Pending' : 'Managed by hiring team'}
	                        </span>
	                      )}
                      {interview?.status === 'confirmed' && interview?.hasScheduledDate && (
                        String(interview?.mode || '').toUpperCase() === 'HIRING' ? (
                          interview?.canDirectJoinHiringInterview ? (
                            <Button
                              variant="default"
                              size="sm"
                              iconName="Video"
                              iconPosition="left"
                              onClick={() => navigate(`/live-interview-session?interviewId=${encodeURIComponent(interview.id)}`)}
                              className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/40 text-xs transition-all sm:w-auto sm:flex-none"
                            >
                              Join Interview Now
                            </Button>
                          ) : (
                            <span className="inline-flex w-full items-center justify-center rounded-full border border-blue-200/80 dark:border-blue-500/30 px-3 py-1.5 text-[11px] text-center text-blue-700 dark:text-blue-200 bg-blue-50/70 dark:bg-blue-500/10 whitespace-normal leading-relaxed sm:w-auto sm:justify-start sm:text-left">
                              {getCandidateMeetingLinkEmailNotice()}
                            </span>
                          )
                        ) : (
	                  <Button
	                    variant="default"
                    size="sm"
                    iconName="Video"
                    iconPosition="left"
                    onClick={() => navigate(`/live-interview-session?interviewId=${encodeURIComponent(interview.id)}`)}
                          className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700 hover:shadow-lg hover:shadow-blue-500/40 text-xs transition-all sm:w-auto sm:flex-none"
                  >
                          Join
                        </Button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (

        <div className="px-4 sm:px-5 text-center py-8">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-500/15 dark:to-purple-500/15 border border-blue-200/50 dark:border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Icon name="CalendarX2" size={26} className="text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1.5">No Upcoming Interviews</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-5 max-w-xs mx-auto leading-relaxed">
              You don&apos;t have any scheduled interviews yet. Stay sharp with practice sessions while your applications progress.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconName="Briefcase"
                iconPosition="left"
                onClick={() => navigate('/my-applications')}
                className="rounded-full border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 hover:text-blue-600 dark:hover:text-blue-400"
              >
                View Applications
              </Button>
              <Button
                variant="default"
                size="sm"
                iconName="Play"
                iconPosition="left"
                onClick={() => navigate('/practice-interview-setup')}
                className="rounded-full bg-gradient-to-r from-blue-600 to-purple-600 border-none text-white shadow-md shadow-blue-500/30 hover:from-blue-700 hover:to-purple-700"
              >
                Start Practice
              </Button>
            </div>
          </div>
        )}


      </div>
      {scheduleModal}
    </>);

};

export default SchedulingWidget;
