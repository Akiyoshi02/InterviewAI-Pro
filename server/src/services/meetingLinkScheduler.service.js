import logger from '../utils/logger.js';
import { interviewStore, userStore, jobStore, organizationStore } from './firebaseData.service.js';
import { shouldSendMeetingLinkEmail, buildMeetingJoinUrl, MEETING_LINK_EMAIL_MINUTES_BEFORE } from './meetingLink.service.js';
import { emailNotifications } from './email.service.js';
import { queueEmailJob } from './backgroundJobQueue.service.js';

/** Check interval in milliseconds (every 5 minutes). */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

let intervalHandle = null;

/**
 * Query interviews that are approaching their scheduled time and
 * haven't had the meeting-link email sent yet.
 */
async function findUpcomingInterviewsNeedingEmail() {
  const now = new Date();
  const windowStart = new Date(now.getTime());
  const windowEnd = new Date(now.getTime() + (MEETING_LINK_EMAIL_MINUTES_BEFORE + 5) * 60 * 1000);

  try {
    const interviews = await interviewStore.listScheduledBetween(
      windowStart.toISOString(),
      windowEnd.toISOString(),
    );
    return (interviews || []).filter(shouldSendMeetingLinkEmail);
  } catch (err) {
    logger.error('meetingLinkScheduler: failed to query upcoming interviews:', err);
    return [];
  }
}

/**
 * Send the meeting-link email for a single interview and mark it as sent.
 */
async function sendMeetingLinkEmailForInterview(interview) {
  const joinUrl = buildMeetingJoinUrl(interview.id, interview.meetingToken);
  if (!joinUrl) return;

  try {
    const [candidate, job, organization] = await Promise.all([
      interview.candidateId ? userStore.getSummary(interview.candidateId) : null,
      interview.jobId ? jobStore.getById(interview.jobId) : null,
      interview.organizationId ? organizationStore.getById(interview.organizationId) : null,
    ]);
    if (!candidate?.email || !organization) {
      logger.warn(`meetingLinkScheduler: missing email context for interview ${interview.id}`);
      return;
    }

    queueEmailJob({
      type: 'MEETING_LINK_REMINDER',
      payload: {
        interviewId: interview.id,
        candidateId: interview.candidateId || null,
        recipient: candidate.email,
      },
      handler: async () => {
        await emailNotifications.sendMeetingLinkReminder(interview, candidate, job, organization, joinUrl);
        logger.info(`meetingLinkScheduler: meeting link email sent to ${candidate.email} for interview ${interview.id}`);
      },
    });
  } catch (err) {
    logger.error(`meetingLinkScheduler: error preparing email for interview ${interview.id}:`, err);
    return;
  }

  // Mark as sent so we don't resend
  try {
    await interviewStore.update(interview.id, { meetingLinkEmailSent: true });
  } catch (err) {
    logger.error(`meetingLinkScheduler: failed to mark meetingLinkEmailSent for interview ${interview.id}:`, err);
  }
}

/**
 * Single tick: find interviews needing the meeting link email and dispatch.
 */
async function tick() {
  try {
    const interviews = await findUpcomingInterviewsNeedingEmail();
    if (interviews.length === 0) return;

    logger.info(`meetingLinkScheduler: ${interviews.length} interview(s) need meeting link email`);

    for (const interview of interviews) {
      await sendMeetingLinkEmailForInterview(interview);
    }
  } catch (err) {
    logger.error('meetingLinkScheduler tick error:', err);
  }
}

/**
 * Start the periodic meeting-link email scheduler.
 */
export function startMeetingLinkScheduler() {
  if (intervalHandle) return;
  logger.info(`meetingLinkScheduler: started (checking every ${CHECK_INTERVAL_MS / 60_000} min)`);
  // Run immediately on startup, then every CHECK_INTERVAL_MS
  tick();
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS);
}

/**
 * Stop the scheduler (for graceful shutdown).
 */
export function stopMeetingLinkScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('meetingLinkScheduler: stopped');
  }
}
