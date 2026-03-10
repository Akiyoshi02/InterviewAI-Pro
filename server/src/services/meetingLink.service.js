import crypto from 'crypto';
import logger from '../utils/logger.js';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Meeting-link tokens are generated when an interview is scheduled and
 * stored on the interview document as `meetingToken` / `meetingTokenGeneratedAt`.
 *
 * The matching join URL is only revealed to the candidate via email
 * shortly before the scheduled time (see meetingLinkScheduler).
 * On reschedule the old token is replaced, invalidating any earlier link.
 *
 * The lobby page validates: token matches, token not expired,
 * and current time is within the access window.
 */

const TOKEN_BYTES = 32; // 256-bit random token

/** How many minutes before the scheduled time the link becomes accessible. */
export const MEETING_LINK_ACCESS_WINDOW_MINUTES = 30;

/** How many minutes before the scheduled time the reminder email is sent. */
export const MEETING_LINK_EMAIL_MINUTES_BEFORE = 30;

/** How long a queued reminder can stay pending before the scheduler retries it. */
export const MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES = 10;

/** How long to wait after a permanent reminder failure before retrying. */
export const MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES = 5;

/** Default duration in minutes if an interview has no explicit duration. */
const DEFAULT_INTERVIEW_DURATION_MINUTES = 30;

/**
 * Generate a fresh meeting token for an interview.
 * Returns { meetingToken, meetingTokenGeneratedAt }.
 */
export function generateMeetingToken() {
  return {
    meetingToken: crypto.randomBytes(TOKEN_BYTES).toString('hex'),
    meetingTokenGeneratedAt: new Date().toISOString(),
    meetingLinkEmailSent: false,
  };
}

/**
 * Build the full meeting join URL for a given interview + token.
 */
export function buildMeetingJoinUrl(interviewId, meetingToken) {
  if (!interviewId || !meetingToken) return null;
  return `${FRONTEND_URL}/interview-lobby/${encodeURIComponent(interviewId)}?token=${encodeURIComponent(meetingToken)}`;
}

export function validateMeetingToken(interview, suppliedToken) {
  if (!interview) {
    return { valid: false, code: 'NOT_FOUND', message: 'Interview not found.' };
  }

  if (!interview.meetingToken) {
    return { valid: false, code: 'NO_TOKEN', message: 'Meeting link has not been generated yet.' };
  }

  const expected = Buffer.from(interview.meetingToken, 'utf-8');
  const supplied = Buffer.from(String(suppliedToken || ''), 'utf-8');
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
    return { valid: false, code: 'INVALID_TOKEN', message: 'The meeting link is invalid or has expired.' };
  }

  return { valid: true };
}

/**
 * Validate whether a candidate may access the interview lobby right now.
 *
 * Returns { valid: true } or { valid: false, code, message }.
 */
export function validateMeetingAccess(interview, suppliedToken) {
  const tokenValidation = validateMeetingToken(interview, suppliedToken);
  if (!tokenValidation.valid) {
    return tokenValidation;
  }

  if (!interview.scheduledFor) {
    return { valid: false, code: 'NOT_SCHEDULED', message: 'This interview has not been scheduled yet.' };
  }

  const scheduledMs = new Date(interview.scheduledFor).getTime();
  if (Number.isNaN(scheduledMs)) {
    return { valid: false, code: 'INVALID_SCHEDULE', message: 'Invalid schedule date.' };
  }

  const nowMs = Date.now();
  const windowOpenMs = scheduledMs - MEETING_LINK_ACCESS_WINDOW_MINUTES * 60 * 1000;
  const durationMs = (interview.duration || DEFAULT_INTERVIEW_DURATION_MINUTES) * 60 * 1000;
  const windowCloseMs = scheduledMs + durationMs;

  if (nowMs < windowOpenMs) {
    const minsUntilOpen = Math.ceil((windowOpenMs - nowMs) / 60_000);
    return {
      valid: false,
      code: 'TOO_EARLY',
      message: `The meeting link will become accessible ${minsUntilOpen} minute${minsUntilOpen === 1 ? '' : 's'} from now.`,
    };
  }

  if (nowMs > windowCloseMs) {
    return { valid: false, code: 'EXPIRED', message: 'The meeting window has closed.' };
  }

  return { valid: true };
}

/**
 * Determine whether the meeting-link reminder email should be sent for an interview.
 * Called by the periodic scheduler.
 */
export function shouldSendMeetingLinkEmail(interview) {
  if (!interview?.scheduledFor || !interview?.meetingToken) return false;
  if (interview.meetingLinkEmailSent) return false;
  if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') return false;

  const scheduledMs = new Date(interview.scheduledFor).getTime();
  if (Number.isNaN(scheduledMs)) return false;

  const nowMs = Date.now();
  const queuedAtMs = Date.parse(interview.meetingLinkEmailPendingAt || '');
  if (Number.isFinite(queuedAtMs) && (nowMs - queuedAtMs) < (MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES * 60 * 1000)) {
    return false;
  }

  const lastFailureMs = Date.parse(interview.meetingLinkEmailFailureAt || '');
  if (Number.isFinite(lastFailureMs) && (nowMs - lastFailureMs) < (MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES * 60 * 1000)) {
    return false;
  }

  const sendAtMs = scheduledMs - MEETING_LINK_EMAIL_MINUTES_BEFORE * 60 * 1000;

  // Send if we're within the window (between sendAt and scheduled time)
  return nowMs >= sendAtMs && nowMs <= scheduledMs;
}

export default {
  generateMeetingToken,
  buildMeetingJoinUrl,
  validateMeetingToken,
  validateMeetingAccess,
  shouldSendMeetingLinkEmail,
  MEETING_LINK_ACCESS_WINDOW_MINUTES,
  MEETING_LINK_EMAIL_MINUTES_BEFORE,
  MEETING_LINK_EMAIL_PENDING_GRACE_MINUTES,
  MEETING_LINK_EMAIL_FAILURE_RETRY_MINUTES,
};
