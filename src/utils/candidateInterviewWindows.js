import { MEETING_LINK_POST_END_GRACE_MINUTES } from '../constants/interviewMeetingLink.js';

const DEFAULT_INTERVIEW_DURATION_MINUTES = 30;
const ACTIVE_CANDIDATE_INTERVIEW_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS', 'PAUSED']);

export const resolveInterviewDurationMinutes = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return DEFAULT_INTERVIEW_DURATION_MINUTES;
};

export const getInterviewAccessWindow = (interview) => {
  const scheduledMs = Date.parse(interview?.scheduledFor || '');
  if (!Number.isFinite(scheduledMs)) return null;

  const durationMs = resolveInterviewDurationMinutes(interview?.duration) * 60 * 1000;
  const graceMs = MEETING_LINK_POST_END_GRACE_MINUTES * 60 * 1000;

  return {
    scheduledMs,
    windowCloseMs: scheduledMs + durationMs + graceMs,
  };
};

export const isInterviewAccessWindowOpen = (interview, nowMs = Date.now()) => {
  const accessWindow = getInterviewAccessWindow(interview);
  if (!accessWindow) return false;
  return nowMs >= accessWindow.scheduledMs && nowMs <= accessWindow.windowCloseMs;
};

export const isCandidateInterviewStillRelevant = (interview, nowMs = Date.now()) => {
  const accessWindow = getInterviewAccessWindow(interview);
  if (!accessWindow) return true;
  return nowMs <= accessWindow.windowCloseMs;
};

export const getCandidateActiveInterviews = (interviews = [], nowMs = Date.now()) =>
  (Array.isArray(interviews) ? interviews : []).filter((interview) => {
    const status = String(interview?.status || '').trim().toUpperCase();
    if (!ACTIVE_CANDIDATE_INTERVIEW_STATUSES.has(status)) return false;
    return isCandidateInterviewStillRelevant(interview, nowMs);
  });

export const getCandidateUpcomingScheduledInterviews = (interviews = [], nowMs = Date.now()) =>
  getCandidateActiveInterviews(interviews, nowMs)
    .filter((interview) => {
      if (String(interview?.status || '').trim().toUpperCase() !== 'SCHEDULED') return false;
      return Number.isFinite(Date.parse(interview?.scheduledFor || ''));
    })
    .sort((left, right) => {
      const leftMs = Date.parse(left?.scheduledFor || '') || Number.MAX_SAFE_INTEGER;
      const rightMs = Date.parse(right?.scheduledFor || '') || Number.MAX_SAFE_INTEGER;
      return leftMs - rightMs;
    });
