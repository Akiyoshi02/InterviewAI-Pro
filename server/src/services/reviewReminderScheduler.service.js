import logger from '../utils/logger.js';
import {
  interviewStore,
  jobStore,
  notificationStore,
  organizationStore,
  userStore,
} from './firebaseData.service.js';
import { emailNotifications } from './email.service.js';
import { queueEmailJob } from './backgroundJobQueue.service.js';
import {
  getReviewRequestReminderDecision,
  markReviewRequestReminder,
  normalizeReviewRequests,
  syncReviewRequests,
} from '../utils/reviewRequest.util.js';

const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MAX_COMPLETED_INTERVIEWS_PER_TICK = 400;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

let intervalHandle = null;

const getCached = async (cache, key, loader) => {
  if (!key) return null;
  if (cache.has(key)) {
    return cache.get(key);
  }

  const value = await loader();
  cache.set(key, value || null);
  return value || null;
};

const buildAssignedReviewsUrl = (interviewId) => {
  const baseUrl = FRONTEND_URL.replace(/\/$/, '');
  const params = new URLSearchParams();
  if (interviewId) {
    params.set('interviewId', interviewId);
  }
  const query = params.toString();
  return `${baseUrl}/company-reviews${query ? `?${query}` : ''}`;
};

const resolveEffectiveReviewRequests = (interview, fallbackReviewRequests = []) => {
  const existingReviewRequests = normalizeReviewRequests(interview?.reviewRequests);
  if (existingReviewRequests.length > 0) {
    return existingReviewRequests;
  }

  if (fallbackReviewRequests.length > 0) {
    return normalizeReviewRequests(fallbackReviewRequests);
  }

  return syncReviewRequests({
    existingReviewRequests: [],
    reviewerAssignments: interview?.reviewerAssignments,
    assignedBy: interview?.scheduledBy || interview?.companyId || null,
    interview,
    nowValue: interview?.completedAt || interview?.updatedAt || new Date().toISOString(),
  });
};

async function findReviewRequestsNeedingReminder() {
  try {
    const interviews = await interviewStore.listCompletedForReviewReminders({
      limit: MAX_COMPLETED_INTERVIEWS_PER_TICK,
    });

    return interviews.flatMap((interview) => {
      const effectiveReviewRequests = resolveEffectiveReviewRequests(interview);
      return effectiveReviewRequests
        .map((request) => {
          const decision = getReviewRequestReminderDecision(request, interview, {
            nowValue: Date.now(),
          });

          return {
            interview,
            reviewRequest: request,
            effectiveReviewRequests,
            decision,
          };
        })
        .filter((item) => item.decision.shouldSend);
    });
  } catch (error) {
    logger.error('reviewReminderScheduler: failed to query completed interviews:', error);
    return [];
  }
}

async function enqueueReminder(reminder, caches) {
  const { interview, reviewRequest, effectiveReviewRequests, decision } = reminder;

  try {
    const [reviewer, candidate, job, organization] = await Promise.all([
      getCached(caches.users, reviewRequest.reviewerId, () => userStore.getSummary(reviewRequest.reviewerId)),
      interview.candidateId ? getCached(caches.users, interview.candidateId, () => userStore.getSummary(interview.candidateId)) : Promise.resolve(null),
      interview.jobId ? getCached(caches.jobs, interview.jobId, () => jobStore.getById(interview.jobId)) : Promise.resolve(null),
      interview.organizationId ? getCached(caches.organizations, interview.organizationId, () => organizationStore.getById(interview.organizationId)) : Promise.resolve(null),
    ]);

    if (!reviewer?.email || !organization) {
      logger.warn(`reviewReminderScheduler: missing reminder context for interview ${interview.id} reviewer ${reviewRequest.reviewerId}`);
      return;
    }

    const reviewUrl = buildAssignedReviewsUrl(interview.id);
    const notificationTitle = decision.workflowState === 'OVERDUE'
      ? 'Review overdue'
      : 'Review due soon';
    const candidateLabel = candidate?.fullName || 'candidate';
    const roleLabel = job?.title || interview?.jobRole || 'assigned interview';
    const notificationMessage = decision.workflowState === 'OVERDUE'
      ? `Your review for ${candidateLabel} (${roleLabel}) is overdue.`
      : `Your review for ${candidateLabel} (${roleLabel}) is due soon.`;

    const jobId = queueEmailJob({
      type: 'REVIEW_REQUEST_REMINDER',
      payload: {
        interviewId: interview.id,
        reviewerId: reviewRequest.reviewerId,
        recipient: reviewer.email,
        workflowState: decision.workflowState,
      },
      handler: async () => {
        await emailNotifications.sendReviewRequestReminder({
          interview,
          reviewer,
          candidate,
          job,
          company: organization,
          reviewRequest,
          workflowState: decision.workflowState,
          reviewUrl,
        });
        logger.info(`reviewReminderScheduler: reminder email sent to ${reviewer.email} for interview ${interview.id}`);
      },
      onSuccess: async () => {
        const latestInterview = await interviewStore.getById(interview.id).catch(() => null);
        const latestReviewRequests = resolveEffectiveReviewRequests(
          latestInterview || interview,
          effectiveReviewRequests,
        );
        const nextReviewRequests = markReviewRequestReminder({
          reviewRequests: latestReviewRequests,
          reviewerId: reviewRequest.reviewerId,
          remindedAt: new Date().toISOString(),
          workflowState: decision.workflowState,
          channel: 'EMAIL',
          source: 'AUTOMATED',
        });

        await interviewStore.update(interview.id, {
          reviewRequests: nextReviewRequests,
        });

        try {
          await notificationStore.create({
            userId: reviewRequest.reviewerId,
            type: 'review_reminder',
            title: notificationTitle,
            message: notificationMessage,
            link: `/company-reviews?interviewId=${encodeURIComponent(interview.id)}`,
            metadata: {
              interviewId: interview.id,
              reviewerId: reviewRequest.reviewerId,
              workflowState: decision.workflowState,
              dueAt: reviewRequest.dueAt || null,
            },
          });
        } catch (notificationError) {
          logger.warn(
            `reviewReminderScheduler: reminder email sent but notification creation failed for interview ${interview.id} reviewer ${reviewRequest.reviewerId}`,
            notificationError,
          );
        }
      },
    });

    if (!jobId) {
      logger.warn(`reviewReminderScheduler: failed to enqueue reminder for interview ${interview.id} reviewer ${reviewRequest.reviewerId}`);
    }
  } catch (error) {
    logger.error(`reviewReminderScheduler: error preparing reminder for interview ${interview.id} reviewer ${reviewRequest.reviewerId}:`, error);
  }
}

async function tick() {
  try {
    const reminders = await findReviewRequestsNeedingReminder();
    if (reminders.length === 0) return;

    logger.info(`reviewReminderScheduler: ${reminders.length} review reminder(s) need delivery`);

    const caches = {
      users: new Map(),
      jobs: new Map(),
      organizations: new Map(),
    };

    for (const reminder of reminders) {
      await enqueueReminder(reminder, caches);
    }
  } catch (error) {
    logger.error('reviewReminderScheduler tick error:', error);
  }
}

export function startReviewReminderScheduler() {
  if (intervalHandle) return;
  logger.info(`reviewReminderScheduler: started (checking every ${CHECK_INTERVAL_MS / 60_000} min)`);
  tick();
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopReviewReminderScheduler() {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
  logger.info('reviewReminderScheduler: stopped');
}
