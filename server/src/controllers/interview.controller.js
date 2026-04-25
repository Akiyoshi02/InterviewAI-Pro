import { LLMService } from '../services/llm.service.js';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import admin from '../config/firebase.js';
import {
  activityLogStore,
  hydrateInterviewParticipants,
  interviewStore,
  invitationStore,
  jobApplicationStore,
  jobStore,
  organizationStore,
  notificationStore,
  publishAdminRealtimeUpdate,
  publishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate,
  recordRealtimeEvent,
  reviewStore,
  systemSettingsStore,
  userStore,
} from '../services/firebaseData.service.js';
import { emailNotifications } from '../services/email.service.js';
import { queueEmailJob } from '../services/backgroundJobQueue.service.js';
import { createSignedDownloadPath } from '../services/localObjectStorage.service.js';
import {
  evaluateSlotAgainstInterviewAutomation,
  isNonTerminalScheduledInterview,
  resolveInterviewAutomationSettings,
  selectSlotFromPreferredOrAuto,
} from '../services/interviewScheduling.service.js';
import {
  completeLinkedInterviewPlanStage,
  createNextInterviewPlanStage,
} from '../services/hiringInterviewPlan.service.js';
import {
  generateMeetingToken,
  isWithinMeetingAccessWindow,
  validateMeetingAccess,
  validateMeetingToken,
} from '../services/meetingLink.service.js';
import {
  applyQuestionStrategyDefaults,
  buildStructuredInterviewQuestionPlanAsync,
  buildStructuredInterviewQuestionPlan,
  computeRubricWeightedScore,
  normalizeOrganizationTemplateForPlanner,
  reconcileQuestionScore,
} from '../services/structuredInterview.service.js';
import { uploadsPaths } from '../middleware/upload.middleware.js';
import {
  appendStatusHistory,
  buildStatusHistoryEntry,
  normalizeDisposition,
  normalizeApplicationStatus,
} from '../utils/applicationLifecycle.util.js';
import {
  isReviewerAssignedToInterview,
  isReviewerRole,
} from '../utils/reviewerAccess.util.js';
import { validateReviewerAssignmentsForOrganization } from '../utils/reviewerAssignment.util.js';
import {
  applyReviewRequestUpdates,
  enrichInterviewReviewRequests,
  markReviewRequestReminder,
  syncReviewRequests,
} from '../utils/reviewRequest.util.js';
import {
  canAdvanceFromInterviewPlanStage,
  getInterviewPlanStage,
  getNextInterviewPlanStage,
  normalizeInterviewPlanSnapshot,
  updateInterviewPlanStageOutcome,
  sanitizeInterviewPlanForClient,
} from '../utils/interviewPlan.util.js';
import { ReferralController } from './referral.controller.js';
import logger from '../utils/logger.js';

const ensureAccess = (interview, user, { allowOrganizationMembers = true } = {}) => {
  if (!interview) {
    return { allowed: false, status: 404, message: 'Interview not found' };
  }

  const normalizedUserId = typeof user === 'string' ? user : user?.id;
  const viewerAccountType = user?.accountType || null;
  const viewerOrganizationId = user?.organizationContext?.organization?.id || null;

  const isDirectParticipant = interview.candidateId === normalizedUserId || interview.companyId === normalizedUserId;
  if (isDirectParticipant) {
    return { allowed: true };
  }

  const isOrganizationMember = allowOrganizationMembers
    && viewerAccountType === 'COMPANY'
    && Boolean(viewerOrganizationId)
    && interview.organizationId === viewerOrganizationId;

  if (!isOrganizationMember) {
    return { allowed: false, status: 403, message: 'Access denied' };
  }

  if (isReviewerRole(user) && !isReviewerAssignedToInterview(interview, normalizedUserId)) {
    return { allowed: false, status: 403, message: 'Access denied' };
  }

  return { allowed: true };
};

const filterInterviewsForReviewer = (interviews = [], reviewerId = null) => (
  Array.isArray(interviews)
    ? interviews.filter((interview) => isReviewerAssignedToInterview(interview, reviewerId))
    : []
);

const canCreateHiringInterview = (role) => {
  const normalizedRole = String(role || '').toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'RECRUITER';
};

const SCHEDULING_ROLES = new Set(['ADMIN', 'RECRUITER']);
const RECORDING_VIEW_ROLES = new Set(['ADMIN', 'RECRUITER', 'REVIEWER']);
const RECORDING_UPLOAD_ROLES = new Set(['ADMIN', 'RECRUITER']);
const DEFAULT_TIMEZONE = process.env.DEFAULT_INTERVIEW_TIMEZONE || 'UTC';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const MAX_RESCHEDULE_REQUESTS_PER_INTERVIEW = Math.max(
  1,
  Number.parseInt(process.env.MAX_RESCHEDULE_REQUESTS_PER_INTERVIEW || '1', 10) || 1,
);
const RESCHEDULE_REQUEST_COOLDOWN_HOURS = Math.max(
  1,
  Number.parseInt(process.env.RESCHEDULE_REQUEST_COOLDOWN_HOURS || '12', 10) || 12,
);
const RESCHEDULE_MIN_NOTICE_HOURS = Math.max(
  1,
  Number.parseInt(process.env.RESCHEDULE_MIN_NOTICE_HOURS || '6', 10) || 6,
);
const RESCHEDULE_REASON_MIN_LENGTH = Math.max(
  10,
  Number.parseInt(process.env.RESCHEDULE_REASON_MIN_LENGTH || '20', 10) || 20,
);
const RESCHEDULE_REASON_MAX_LENGTH = 500;
const MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS = Math.max(
  1,
  Number.parseInt(process.env.MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS || '6', 10) || 6,
);
const COMPLETED_RECORDING_UPLOAD_GRACE_MS = Math.max(
  60 * 1000,
  Number.parseInt(process.env.COMPLETED_RECORDING_UPLOAD_GRACE_MS || `${15 * 60 * 1000}`, 10) || (15 * 60 * 1000),
);
const MAX_PREFERRED_RESCHEDULE_SLOTS = 3;
const INTERVIEW_SCHEDULING_STRATEGIES = new Set(['MANUAL', 'AUTO', 'PREFERRED_FIRST']);

const normalizeIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const isFutureDateTime = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
};

const normalizeRescheduleRequests = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((request) => (request && typeof request === 'object' ? request : null))
    .filter(Boolean)
    .map((request) => ({
      id: typeof request.id === 'string' ? request.id : crypto.randomUUID(),
      status: ['PENDING', 'APPROVED', 'REJECTED'].includes(String(request.status || '').toUpperCase())
        ? String(request.status || '').toUpperCase()
        : 'PENDING',
      reason: typeof request.reason === 'string' ? request.reason.trim() : '',
      preferredSlots: Array.isArray(request.preferredSlots)
        ? request.preferredSlots
          .map((slot) => normalizeIsoDate(slot))
          .filter(Boolean)
        : [],
      timezone: typeof request.timezone === 'string' && request.timezone.trim()
        ? request.timezone.trim()
        : null,
      requestedAt: normalizeIsoDate(request.requestedAt) || new Date().toISOString(),
      requestedBy: request.requestedBy || null,
      reviewedAt: normalizeIsoDate(request.reviewedAt),
      reviewedBy: request.reviewedBy || null,
      reviewNote: typeof request.reviewNote === 'string' && request.reviewNote.trim()
        ? request.reviewNote.trim()
        : null,
      decisionSource: typeof request.decisionSource === 'string' && request.decisionSource.trim()
        ? request.decisionSource.trim()
        : null,
    }))
    .sort((left, right) => Date.parse(left.requestedAt || 0) - Date.parse(right.requestedAt || 0));
};

const getPendingRescheduleRequest = (interview) => {
  const requests = normalizeRescheduleRequests(interview?.rescheduleRequests);
  for (let index = requests.length - 1; index >= 0; index -= 1) {
    if (requests[index].status === 'PENDING') {
      return requests[index];
    }
  }
  return null;
};

const enrichInterviewSchedulingMeta = (interview) => {
  if (!interview) return interview;
  const normalizedRequests = normalizeRescheduleRequests(interview.rescheduleRequests);
  const pendingRescheduleRequest = getPendingRescheduleRequest({ rescheduleRequests: normalizedRequests });
  return {
    ...interview,
    rescheduleRequests: normalizedRequests,
    pendingRescheduleRequest,
  };
};

const buildAbsoluteApiUrl = (req, relativePath) => {
  if (!relativePath || typeof relativePath !== 'string') return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath;
  const origin = `${req.protocol}://${req.get('host')}`;
  return `${origin}${relativePath.startsWith('/') ? relativePath : `/${relativePath}`}`;
};

const toUploadsPublicPath = (absolutePath) => {
  const uploadsRoot = path.resolve(uploadsPaths.root);
  const resolved = path.resolve(absolutePath || '');
  if (!resolved.startsWith(`${uploadsRoot}${path.sep}`)) return null;
  const relative = path.relative(uploadsRoot, resolved).replaceAll('\\', '/');
  if (!relative || relative.includes('..')) return null;
  return `/uploads/${relative}`;
};

const isLikelyOllamaUnavailableError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  return [
    'econnrefused',
    'fetch failed',
    'failed to fetch',
    'ollama',
    'socket hang up',
    'connect',
    'timed out',
    'timeout',
  ].some((token) => message.includes(token) || code.includes(token));
};

const buildFallbackQuestions = (interview) => {
  const role = interview?.jobRole || 'this role';
  const focus = Array.isArray(interview?.skillFocus) && interview.skillFocus.length
    ? interview.skillFocus[0]
    : 'core responsibilities';

  return [
    {
      id: 'fallback_q1',
      type: 'behavioral',
      difficulty: 'medium',
      question: `Tell me about yourself and why you are interested in ${role}.`,
      expectedDuration: 3,
      evaluationCriteria: ['clarity', 'motivation', 'role alignment'],
    },
    {
      id: 'fallback_q2',
      type: 'behavioral',
      difficulty: 'medium',
      question: `Describe a situation where you solved a difficult problem related to ${focus}.`,
      expectedDuration: 4,
      evaluationCriteria: ['STAR structure', 'problem solving', 'impact'],
    },
    {
      id: 'fallback_q3',
      type: 'behavioral',
      difficulty: 'medium',
      question: 'Describe a time you received critical feedback. What changed afterward?',
      expectedDuration: 3,
      evaluationCriteria: ['self-awareness', 'growth mindset', 'communication'],
    },
    {
      id: 'fallback_q4',
      type: 'behavioral',
      difficulty: 'medium',
      question: 'How do you prioritize work when multiple deadlines conflict?',
      expectedDuration: 3,
      evaluationCriteria: ['prioritization', 'decision quality', 'execution'],
    },
    {
      id: 'fallback_q5',
      type: 'behavioral',
      difficulty: 'medium',
      question: 'Do you have any questions for the team or role?',
      expectedDuration: 2,
      evaluationCriteria: ['engagement', 'preparation', 'clarity'],
    },
  ];
};

const canManageSchedule = (interview, user) => {
  const access = ensureAccess(interview, user, { allowOrganizationMembers: true });
  if (!access.allowed) return access;

  // Candidate can manage only their own practice interview scheduling.
  if (user?.accountType === 'CANDIDATE') {
    if (interview?.mode === 'PRACTICE' && interview?.candidateId === user?.id) {
      return { allowed: true };
    }
    return { allowed: false, status: 403, message: 'Only company scheduling members can manage this interview' };
  }

  if (user?.accountType === 'COMPANY') {
    const organizationRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();
    if (SCHEDULING_ROLES.has(organizationRole)) return { allowed: true };
    return { allowed: false, status: 403, message: 'Insufficient organization role for scheduling' };
  }

  return { allowed: false, status: 403, message: 'Access denied' };
};

const canViewRecording = (interview, user) => {
  const access = ensureAccess(interview, user, { allowOrganizationMembers: true });
  if (!access.allowed) return access;

  if (user?.accountType === 'COMPANY') {
    const organizationRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();
    if (!RECORDING_VIEW_ROLES.has(organizationRole)) {
      return { allowed: false, status: 403, message: 'Insufficient organization role for recording access' };
    }
  }

  return { allowed: true };
};

const attachSingleInterviewParticipants = async (interview) => {
  if (!interview) return null;
  const participantIds = new Set([interview.candidateId, interview.companyId].filter(Boolean));
  const reviewerAssignments = Array.isArray(interview?.reviewerAssignments)
    ? interview.reviewerAssignments
    : [];
  reviewerAssignments.forEach((reviewerId) => {
    if (reviewerId) {
      participantIds.add(reviewerId);
    }
  });
  const [participantMap, organization] = await Promise.all([
    userStore.getSummaries(Array.from(participantIds)),
    interview.organizationId
      ? Promise.resolve(organizationStore.getById(interview.organizationId)).catch(() => null)
      : Promise.resolve(null),
  ]);

  const interviewWithParticipants = {
    ...interview,
    candidate: interview.candidateId ? participantMap.get(interview.candidateId) || null : null,
    company: interview.companyId ? participantMap.get(interview.companyId) || null : null,
    organization: organization ? {
      id: organization.id || interview.organizationId,
      name: organization.name || organization.displayName || 'Company',
      displayName: organization.displayName || organization.name || 'Company',
      logo: organization.logo || null,
    } : null,
    reviewerAssignees: reviewerAssignments
      .map((reviewerId) => participantMap.get(reviewerId) || null)
      .filter(Boolean),
  };

  return enrichInterviewSchedulingMeta({
    ...interviewWithParticipants,
    ...enrichInterviewReviewRequests(interviewWithParticipants),
  });
};

const isTerminalInterviewStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'COMPLETED' || normalized === 'CANCELLED';
};

const SENSITIVE_INTERVIEW_RESPONSE_FIELDS = [
  'meetingToken',
  'meetingTokenGeneratedAt',
  'meetingLinkEmailSent',
  'meetingLinkEmailSentAt',
  'meetingLinkEmailPendingAt',
  'meetingLinkEmailFailureAt',
];

const sanitizeInterviewForClient = (interview) => {
  if (!interview || typeof interview !== 'object') return interview;
  const sanitized = { ...interview };
  SENSITIVE_INTERVIEW_RESPONSE_FIELDS.forEach((field) => {
    if (field in sanitized) {
      delete sanitized[field];
    }
  });
  return sanitized;
};

const sanitizeInterviewCollectionForClient = (interviews = []) => (
  Array.isArray(interviews) ? interviews.map((interview) => sanitizeInterviewForClient(interview)) : []
);

const buildCandidateLeaderboardDisplayName = (summary, rank) => {
  const fullName = String(summary?.fullName || '').trim();
  if (fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
  }

  const email = String(summary?.email || '').trim();
  if (email.includes('@')) {
    return email.split('@')[0];
  }

  return `Candidate #${rank}`;
};

const attachReviewerQueueState = async (interviews = [], user) => {
  if (!Array.isArray(interviews) || interviews.length === 0 || !isReviewerRole(user)) {
    return interviews;
  }

  const reviewStatuses = await Promise.all(
    interviews.map(async (interview) => {
      const review = await reviewStore.getByInterviewAndReviewer(interview.id, user.id).catch(() => null);
      return [interview.id, review];
    }),
  );

  const reviewStatusMap = new Map(reviewStatuses);
  return interviews.map((interview) => {
    const review = reviewStatusMap.get(interview.id) || null;
    return {
      ...interview,
      myReviewStatus: review ? 'SUBMITTED' : 'PENDING',
      myReviewId: review?.id || null,
      myReviewSubmittedAt: review?.updatedAt || review?.createdAt || null,
    };
  });
};

const attachInterviewPlanContext = async (interviews = []) => {
  if (!Array.isArray(interviews) || interviews.length === 0) {
    return interviews;
  }

  const applicationEntries = await Promise.all(
    interviews.map(async (interview) => {
      if (!interview?.mode || String(interview.mode).toUpperCase() !== 'HIRING') {
        return [interview?.id, null];
      }

      if (interview.applicationId) {
        const application = await jobApplicationStore.getById(interview.applicationId).catch(() => null);
        if (application) {
          return [interview.id, application];
        }
      }

      if (interview.jobId && interview.candidateId) {
        const fallbackApplication = await jobApplicationStore
          .checkDuplicate(interview.jobId, interview.candidateId)
          .catch(() => null);
        return [interview.id, fallbackApplication];
      }

      return [interview?.id, null];
    }),
  );

  const applicationMap = new Map(applicationEntries);
  return interviews.map((interview) => {
    const application = applicationMap.get(interview.id) || null;
    const sanitizedPlan = sanitizeInterviewPlanForClient(application?.interviewPlan);
    const nextStage = sanitizedPlan
      ? getNextInterviewPlanStage(sanitizedPlan, interview?.planStageId || sanitizedPlan.currentStageId)
      : null;

    return {
      ...interview,
      applicationId: interview?.applicationId || application?.id || null,
      applicationStatus: application?.status || null,
      applicationDispositionCode: application?.dispositionCode || null,
      applicationInterviewPlan: sanitizedPlan,
      hasNextPlanStage: Boolean(nextStage),
      nextPlanStage: nextStage
        ? {
          id: nextStage.id,
          name: nextStage.name,
          category: nextStage.category,
          required: nextStage.required !== false,
          advanceRule: nextStage.advanceRule || 'PASS_REQUIRED',
          sequence: nextStage.sequence,
          total: Array.isArray(sanitizedPlan?.stages) ? sanitizedPlan.stages.length : null,
        }
        : null,
    };
  });
};

const finalizeNextInterviewStageCreation = async ({
  nextInterview,
  stageResult,
  actor,
  operation = 'CREATE_NEXT_STAGE_INTERVIEW',
} = {}) => {
  if (!nextInterview || !actor) {
    return {
      interview: nextInterview || null,
    };
  }

  const stageMeta = {
    planStageId: nextInterview.planStageId || stageResult?.currentStage?.id || null,
    planStageName: nextInterview.planStageName || stageResult?.currentStage?.name || null,
  };

  await recordRealtimeEvent(nextInterview.id, 'interview-created', {
    actor: actor.id,
    status: nextInterview.status || 'PENDING',
    mode: nextInterview.mode || null,
    ...stageMeta,
  }).catch((eventError) => {
    logger.warn('Failed to record next-stage interview-created realtime event:', eventError);
  });

  if (nextInterview.organizationId) {
    await publishOrganizationRealtimeUpdate(nextInterview.organizationId, 'interview-created', {
      interviewId: nextInterview.id,
      status: nextInterview.status || 'PENDING',
      candidateId: nextInterview.candidateId || null,
      jobId: nextInterview.jobId || null,
      ...stageMeta,
    }).catch((eventError) => {
      logger.warn('Failed to publish next-stage interview-created organization event:', eventError);
    });
  }

  if (nextInterview.candidateId) {
    await publishCandidateRealtimeUpdate(nextInterview.candidateId, 'interview-created', {
      interviewId: nextInterview.id,
      status: nextInterview.status || 'PENDING',
      organizationId: nextInterview.organizationId || null,
      jobId: nextInterview.jobId || null,
      ...stageMeta,
    }).catch((eventError) => {
      logger.warn('Failed to publish next-stage interview-created candidate event:', eventError);
    });
  }

  if (stageResult?.scheduled && nextInterview.scheduledFor) {
    await activityLogStore.record({
      organizationId: nextInterview.organizationId,
      actorId: actor.id,
      actorRole: actor.organizationContext?.membership?.role || actor.accountType || null,
      action: 'INTERVIEW_NEXT_STAGE_CREATED',
      targetType: 'INTERVIEW',
      targetId: nextInterview.id,
      metadata: {
        scheduledFor: nextInterview.scheduledFor,
        timezone: nextInterview.timezone || null,
        strategy: 'CONSTRAINT_BASED_V1',
        ...stageMeta,
        ...(stageResult.scheduleDecision || {}),
        operation,
      },
    });
    await publishOrganizationRealtimeUpdate(nextInterview.organizationId, 'interview-scheduled', {
      interviewId: nextInterview.id,
      status: nextInterview.status || 'SCHEDULED',
      scheduledFor: nextInterview.scheduledFor || null,
      candidateId: nextInterview.candidateId || null,
      jobId: nextInterview.jobId || null,
      autoScheduled: true,
      strategy: 'CONSTRAINT_BASED_V1',
      ...stageMeta,
    }).catch((eventError) => {
      logger.warn('Failed to publish next-stage interview-scheduled organization event:', eventError);
    });
    await publishCandidateRealtimeUpdate(nextInterview.candidateId, 'interview-scheduled', {
      interviewId: nextInterview.id,
      status: nextInterview.status || 'SCHEDULED',
      scheduledFor: nextInterview.scheduledFor || null,
      organizationId: nextInterview.organizationId || null,
      jobId: nextInterview.jobId || null,
      autoScheduled: true,
      strategy: 'CONSTRAINT_BASED_V1',
      ...stageMeta,
    }).catch((eventError) => {
      logger.warn('Failed to publish next-stage interview-scheduled candidate event:', eventError);
    });

    await queueHiringInterviewEmail({
      type: 'INTERVIEW_SCHEDULED',
      interview: nextInterview,
      payload: {
        operation,
        ...stageMeta,
      },
      send: async ({ candidate, job, organization }) =>
        emailNotifications.sendInterviewScheduled(nextInterview, candidate, job, organization),
      logLabel: 'Next-stage interview scheduled',
    });
  }

  const hydrated = await attachSingleInterviewParticipants(nextInterview);
  const interviewWithPlan = (await attachInterviewPlanContext([hydrated]))[0] || hydrated;
  return {
    interview: interviewWithPlan,
  };
};

const resolveLinkedApplicationForHiringInterview = async (interview) => {
  if (!isHiringInterview(interview)) return null;

  if (interview?.applicationId) {
    const application = await jobApplicationStore.getById(interview.applicationId).catch(() => null);
    if (application) return application;
  }

  if (interview?.jobId && interview?.candidateId) {
    return jobApplicationStore
      .checkDuplicate(interview.jobId, interview.candidateId)
      .catch(() => null);
  }

  return null;
};

const getMeetingTokenFromRequest = (req) => {
  const headerToken = typeof req?.get === 'function'
    ? req.get('x-meeting-token')
    : (req?.headers?.['x-meeting-token'] || req?.headers?.['X-Meeting-Token']);
  const queryToken = typeof req?.query?.token === 'string' ? req.query.token : null;
  const bodyToken = typeof req?.body?.meetingToken === 'string' ? req.body.meetingToken : null;

  return [headerToken, queryToken, bodyToken]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean) || null;
};

const requiresCandidateMeetingToken = (interview, user) => (
  user?.accountType === 'CANDIDATE'
  && interview?.candidateId === user?.id
  && String(interview?.mode || 'HIRING').toUpperCase() === 'HIRING'
);

const canAuthenticatedCandidateJoinAfterScheduledStart = (interview, user) => {
  if (!requiresCandidateMeetingToken(interview, user)) {
    return false;
  }

  if (isTerminalInterviewStatus(interview?.status)) {
    return false;
  }

  const scheduledMs = Date.parse(interview?.scheduledFor || '');
  if (!Number.isFinite(scheduledMs)) {
    return false;
  }

  const nowMs = Date.now();
  if (nowMs < scheduledMs) {
    return false;
  }

  return isWithinMeetingAccessWindow(interview, { nowMs });
};

const canAuthenticatedCandidateUploadCompletedRecording = (interview, user) => {
  if (!requiresCandidateMeetingToken(interview, user)) {
    return false;
  }

  if (String(interview?.status || '').toUpperCase() !== 'COMPLETED') {
    return false;
  }

  const completedMs = Date.parse(interview?.completedAt || interview?.endedAt || '');
  if (!Number.isFinite(completedMs)) {
    return false;
  }

  return Date.now() >= completedMs && (Date.now() - completedMs) <= COMPLETED_RECORDING_UPLOAD_GRACE_MS;
};

const enforceCandidateMeetingTokenAccess = (
  interview,
  req,
  { requireActiveWindow = false, allowCompletedRecordingUpload = false } = {},
) => {
  if (!requiresCandidateMeetingToken(interview, req?.user)) {
    return { allowed: true };
  }

  const meetingToken = getMeetingTokenFromRequest(req);
  if (!meetingToken) {
    if (canAuthenticatedCandidateJoinAfterScheduledStart(interview, req?.user)) {
      return { allowed: true };
    }

    if (allowCompletedRecordingUpload && canAuthenticatedCandidateUploadCompletedRecording(interview, req?.user)) {
      return { allowed: true };
    }

    return {
      allowed: false,
      status: 403,
      code: 'MEETING_LINK_REQUIRED',
      message: 'Use the latest meeting link sent to your email to access this interview.',
    };
  }

  const validation = requireActiveWindow
    ? validateMeetingAccess(interview, meetingToken)
    : validateMeetingToken(interview, meetingToken);

  if (!validation.valid) {
    return {
      allowed: false,
      status: 403,
      code: validation.code,
      message: validation.message,
    };
  }

  return { allowed: true };
};

const canUploadRecording = (interview, user) => {
  const access = ensureAccess(interview, user, { allowOrganizationMembers: false });
  if (!access.allowed) return access;

  if (user?.accountType === 'COMPANY') {
    const organizationRole = String(user?.organizationContext?.membership?.role || '').toUpperCase();
    if (!RECORDING_UPLOAD_ROLES.has(organizationRole)) {
      return { allowed: false, status: 403, message: 'Insufficient organization role for recording upload' };
    }
  }

  return { allowed: true };
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

const APPLICATION_STATUS_EMAIL_MESSAGES = Object.freeze({
  REJECTED: 'Thank you for your interest. We have moved forward with other candidates for this role.',
});

const buildApplicationStatusEmailMessage = ({
  status = null,
  dispositionReason = null,
} = {}) => {
  const normalizedStatus = normalizeApplicationStatus(status);
  if (normalizedStatus !== 'REJECTED') return '';
  const normalizedReason = typeof dispositionReason === 'string' ? dispositionReason.trim() : '';
  return normalizedReason
    ? `Thank you for your interest. ${normalizedReason}`
    : APPLICATION_STATUS_EMAIL_MESSAGES.REJECTED;
};

const autoRejectApplicationForFailedInterviewStage = async ({
  application,
  interview,
  plan,
  stage,
  actor,
  note = null,
} = {}) => {
  if (!application?.id || !stage?.failDispositionCode) {
    return {
      updated: false,
      application,
      status: normalizeApplicationStatus(application?.status),
    };
  }

  const previousStatus = normalizeApplicationStatus(application.status);
  if (!previousStatus || previousStatus === 'REJECTED' || previousStatus === 'HIRED') {
    return {
      updated: false,
      application,
      status: previousStatus,
    };
  }

  const statusChangedAt = new Date().toISOString();
  const stageLabel = String(stage?.name || interview?.planStageName || 'Interview stage').trim();
  const disposition = normalizeDisposition(
    {
      code: stage.failDispositionCode,
      notes: typeof note === 'string' && note.trim() ? note.trim() : null,
    },
    {
      status: 'REJECTED',
      fallbackCode: stage.failDispositionCode,
      fallbackReason: `${stageLabel} was marked as failed.`,
    },
  );

  const statusHistoryEntry = buildStatusHistoryEntry({
    previousStatus,
    status: 'REJECTED',
    changedAt: statusChangedAt,
    changedBy: actor?.id || null,
    source: 'INTERVIEW_STAGE_FAIL',
    note: disposition.notes || disposition.reason || null,
    dispositionCode: disposition.code,
    dispositionCategory: disposition.category,
  });

  const updatedApplication = await jobApplicationStore.update(application.id, {
    interviewPlan: plan,
    status: 'REJECTED',
    reviewedAt: statusChangedAt,
    reviewedBy: actor?.id || null,
    statusSource: 'INTERVIEW_STAGE_FAIL',
    statusChangedAt,
    dispositionCode: disposition.code,
    dispositionCategory: disposition.category,
    dispositionReason: disposition.reason,
    dispositionNotes: disposition.notes,
    dispositionTags: disposition.tags,
    dispositionAt: statusChangedAt,
    dispositionBy: actor?.id || null,
    statusHistory: appendStatusHistory(application.statusHistory, statusHistoryEntry),
  });

  if (updatedApplication.organizationId) {
    await activityLogStore.record({
      organizationId: updatedApplication.organizationId,
      actorId: actor?.id || null,
      actorRole: actor?.organizationContext?.membership?.role || actor?.accountType || null,
      action: 'APPLICATION_STATUS_UPDATED',
      targetType: 'APPLICATION',
      targetId: updatedApplication.id,
      metadata: {
        status: 'REJECTED',
        jobId: updatedApplication.jobId || null,
        dispositionCode: disposition.code || null,
        dispositionCategory: disposition.category || null,
        source: 'INTERVIEW_STAGE_FAIL',
        planStageId: stage.id || interview?.planStageId || null,
        planStageName: stageLabel,
      },
    });
  }

  await publishOrganizationRealtimeUpdate(updatedApplication.organizationId, 'application-status-updated', {
    applicationId: updatedApplication.id,
    jobId: updatedApplication.jobId || null,
    candidateId: updatedApplication.candidateId || null,
    status: updatedApplication.status || 'REJECTED',
  }).catch((eventError) => {
    logger.warn('Failed to publish application-status-updated organization event after stage fail:', eventError);
  });

  await publishCandidateRealtimeUpdate(updatedApplication.candidateId, 'application-status-updated', {
    applicationId: updatedApplication.id,
    jobId: updatedApplication.jobId || null,
    organizationId: updatedApplication.organizationId || null,
    status: updatedApplication.status || 'REJECTED',
  }).catch((eventError) => {
    logger.warn('Failed to publish application-status-updated candidate event after stage fail:', eventError);
  });

  const [candidate, job, organization] = await Promise.all([
    updatedApplication.candidateId ? userStore.getSummary(updatedApplication.candidateId).catch(() => null) : Promise.resolve(null),
    updatedApplication.jobId ? jobStore.getById(updatedApplication.jobId).catch(() => null) : Promise.resolve(null),
    updatedApplication.organizationId ? organizationStore.getById(updatedApplication.organizationId).catch(() => null) : Promise.resolve(null),
  ]);

  if (candidate?.email && job && organization) {
    const statusMessage = buildApplicationStatusEmailMessage({
      status: 'REJECTED',
      dispositionReason: disposition.reason,
    });
    queueEmailJob({
      type: 'APPLICATION_STATUS_UPDATED',
      payload: {
        applicationId: updatedApplication.id,
        candidateId: updatedApplication.candidateId,
        recipient: candidate.email || null,
        status: 'REJECTED',
      },
      handler: async () => {
        await emailNotifications.sendApplicationStatusUpdated(
          updatedApplication,
          candidate,
          job,
          organization,
          statusMessage,
        );
        logger.info(`Stage-fail rejection email sent to ${candidate.email}`);
      },
    });
  }

  return {
    updated: true,
    application: updatedApplication,
    status: 'REJECTED',
    disposition,
  };
};

const DEFAULT_SYSTEM_AI_CONFIG = Object.freeze({
  model: process.env.OLLAMA_MODEL || 'qwen3:8b',
  temperature: 0.7,
  maxTokens: 2000,
});

const clampNumber = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const normalizeAiConfig = (value, fallback = DEFAULT_SYSTEM_AI_CONFIG) => {
  const source = value && typeof value === 'object' ? value : {};
  return {
    model: typeof source.model === 'string' && source.model.trim()
      ? source.model.trim()
      : fallback.model,
    temperature: clampNumber(source.temperature, fallback.temperature, 0, 1),
    maxTokens: Math.round(clampNumber(source.maxTokens, fallback.maxTokens, 256, 32768)),
  };
};

const mergeInterviewConfigWithSystemDefaults = (
  rawConfig,
  systemDefaultAIConfig,
  structuredInterviewDefaults = null,
  mode = 'PRACTICE',
) => {
  const sourceConfig = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const advancedSettings =
    sourceConfig.advancedSettings && typeof sourceConfig.advancedSettings === 'object'
      ? sourceConfig.advancedSettings
      : {};
  const normalizedMode = String(mode || '').toUpperCase() === 'HIRING' ? 'HIRING' : 'PRACTICE';

  const baselineAiConfig = normalizeAiConfig(systemDefaultAIConfig || DEFAULT_SYSTEM_AI_CONFIG);
  const mergedAiConfig = normalizeAiConfig(
    sourceConfig.aiConfig || advancedSettings.aiConfig || {
      model: advancedSettings.model,
      temperature: advancedSettings.temperature,
      maxTokens: advancedSettings.maxTokens,
    },
    baselineAiConfig,
  );
  const modeDefaults = structuredInterviewDefaults
    && typeof structuredInterviewDefaults === 'object'
    && structuredInterviewDefaults[normalizedMode.toLowerCase()]
    && typeof structuredInterviewDefaults[normalizedMode.toLowerCase()] === 'object'
    ? structuredInterviewDefaults[normalizedMode.toLowerCase()]
    : null;
  const sourceQuestionStrategy = sourceConfig.questionStrategy && typeof sourceConfig.questionStrategy === 'object'
    ? sourceConfig.questionStrategy
    : null;
  const mergedQuestionStrategy = applyQuestionStrategyDefaults(
    {
      questionStrategy: {
        ...(modeDefaults || {}),
        ...(sourceQuestionStrategy || {}),
      },
    },
    normalizedMode,
  ).questionStrategy;

  return {
    ...sourceConfig,
    aiConfig: mergedAiConfig,
    questionStrategy: mergedQuestionStrategy,
    advancedSettings: {
      ...advancedSettings,
      aiConfig: mergedAiConfig,
    },
    systemDefaultAIConfig: baselineAiConfig,
  };
};

const resolveInterviewLlmOptions = (interviewConfig) => {
  const config = interviewConfig && typeof interviewConfig === 'object' ? interviewConfig : {};
  const advancedSettings =
    config.advancedSettings && typeof config.advancedSettings === 'object'
      ? config.advancedSettings
      : {};
  return normalizeAiConfig(
    config.aiConfig || advancedSettings.aiConfig || {
      model: advancedSettings.model,
      temperature: advancedSettings.temperature,
      maxTokens: advancedSettings.maxTokens,
    },
  );
};

const EVALUATION_RUN_ROLES = new Set(['ADMIN', 'RECRUITER']);
const getInterviewTemplatesCollection = () => admin.firestore().collection('interviewTemplates');

const resolveOrganizationTemplateOverride = async (interview) => {
  const templateId = String(interview?.config?.questionStrategy?.templateId || '').trim();
  if (!templateId) return null;

  const organizationId = String(interview?.organizationId || '').trim() || null;

  try {
    const templateDoc = await getInterviewTemplatesCollection().doc(templateId).get();
    if (!templateDoc.exists) return null;

    const template = templateDoc.data() || null;
    if (!template) return null;

    const isOrganizationTemplate = organizationId && template.organizationId === organizationId;
    const isPublicTemplate = template.isPublic === true;
    if (!isOrganizationTemplate && !isPublicTemplate) {
      return null;
    }

    return normalizeOrganizationTemplateForPlanner(template, {
      fallbackMode: interview?.mode,
    });
  } catch (error) {
    logger.warn('Failed to resolve organization structured template override.', {
      interviewId: interview?.id || null,
      templateId,
      error: error?.message || String(error),
    });
    return null;
  }
};

const canRunEvaluation = (interview, user) => {
  if (user?.accountType === 'SYSTEM_ADMIN') {
    return { allowed: true };
  }

  const access = ensureAccess(interview, user, { allowOrganizationMembers: true });
  if (!access.allowed) return access;

  if (user?.accountType === 'COMPANY') {
    const role = String(user?.organizationContext?.membership?.role || '').toUpperCase();
    if (EVALUATION_RUN_ROLES.has(role)) {
      return { allowed: true };
    }
    return { allowed: false, status: 403, message: 'Insufficient organization role for evaluation' };
  }

  return { allowed: false, status: 403, message: 'Evaluation access denied' };
};

const buildPendingEvaluationPayload = ({
  reasonCode,
  llmUnavailable = false,
  message = 'AI scoring unavailable; session saved, scoring pending.',
} = {}) => ({
  status: 'PENDING_EVALUATION',
  source: llmUnavailable ? 'FALLBACK' : 'DEFERRED',
  llmUnavailable,
  reasonCode: reasonCode || 'EVALUATION_PENDING',
  message,
  generatedAt: new Date().toISOString(),
});

const evaluateInterviewWithFallback = async ({
  interview,
  questions,
  llmOptions,
  operation = 'end',
} = {}) => {
  const startedAt = Date.now();
  const evaluatedAt = new Date().toISOString();
  const model = llmOptions?.model || DEFAULT_SYSTEM_AI_CONFIG.model;
  const toEvaluationSource = (provider) => {
    const normalized = String(provider || '').trim();
    if (!normalized) return 'UNKNOWN';
    return normalized.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  };

  try {
    const evaluation = await LLMService.generateInterviewSummary({
      interview,
      questions,
      llmOptions,
    });
    const runtimeMeta = evaluation?._meta && typeof evaluation._meta === 'object'
      ? evaluation._meta
      : {};
    const { _meta: _unusedMeta, ...persistedEvaluation } = evaluation || {};
    const durationMs = Date.now() - startedAt;
    return {
      evaluation: {
        ...persistedEvaluation,
        status: 'COMPLETED',
        source: toEvaluationSource(runtimeMeta.provider),
        generatedAt: evaluatedAt,
      },
      pendingEvaluation: false,
      llmUnavailable: false,
      message: null,
      reasonCode: null,
      metadata: {
        provider: runtimeMeta.provider || 'unknown',
        model: runtimeMeta.model || model,
        evaluatedAt,
        durationMs,
        operation,
        pendingEvaluation: false,
        usedFallback: Boolean(runtimeMeta.usedFallback),
        fallbackAttempted: Boolean(runtimeMeta.fallbackAttempted),
        attemptedModels: Array.isArray(runtimeMeta.attemptedModels)
          ? [...runtimeMeta.attemptedModels]
          : [],
      },
    };
  } catch (error) {
    const llmUnavailable = isLikelyOllamaUnavailableError(error);
    const reasonCode = llmUnavailable
      ? 'OLLAMA_UNAVAILABLE'
      : (error?.code === 'LLM_STRUCTURED_OUTPUT_INVALID'
        ? 'INVALID_STRUCTURED_OUTPUT'
        : 'EVALUATION_FAILED');
    const message = llmUnavailable
      ? 'AI scoring unavailable; session saved, scoring pending.'
      : 'AI scoring could not be finalized right now. You can run evaluation later.';
    logger.warn(`Interview evaluation deferred during ${operation}.`, {
      interviewId: interview?.id || null,
      reasonCode,
      llmUnavailable,
      error: error?.message || String(error),
    });
    return {
      evaluation: buildPendingEvaluationPayload({
        reasonCode,
        llmUnavailable,
        message,
      }),
      pendingEvaluation: true,
      llmUnavailable,
      message,
      reasonCode,
      metadata: {
        provider: 'ollama',
        model,
        evaluatedAt,
        durationMs: Date.now() - startedAt,
        operation,
        pendingEvaluation: true,
        reasonCode,
      },
    };
  }
};

const isHiringInterview = (interview) => String(interview?.mode || '').toUpperCase() === 'HIRING';

const loadHiringInterviewEmailContext = async (interview) => {
  if (!isHiringInterview(interview)) return null;

  const runStoreCall = async (storeCall) => {
    if (typeof storeCall !== 'function') return null;
    try {
      const value = storeCall();
      return await Promise.resolve(value);
    } catch {
      return null;
    }
  };

  const loadCandidateSummary = async (candidateId) => {
    if (!candidateId) return null;

    const single = await runStoreCall(() => userStore.getSummary(candidateId));
    if (single) return single;

    const batched = await runStoreCall(() => userStore.getSummaries([candidateId]));
    if (batched instanceof Map) return batched.get(candidateId) || null;
    if (Array.isArray(batched)) {
      return batched.find((entry) => entry?.id === candidateId) || null;
    }
    return null;
  };

  const [candidate, job, organization] = await Promise.all([
    interview?.candidateId ? loadCandidateSummary(interview.candidateId) : null,
    interview?.jobId ? runStoreCall(() => jobStore.getById(interview.jobId)) : null,
    interview?.organizationId ? runStoreCall(() => organizationStore.getById(interview.organizationId)) : null,
  ]);

  if (!candidate?.email || !organization) return null;
  return { candidate, job, organization };
};

const queueHiringInterviewEmail = async ({
  type,
  interview,
  payload = {},
  send,
  logLabel,
}) => {
  if (!isHiringInterview(interview) || typeof send !== 'function') return false;

  const context = await loadHiringInterviewEmailContext(interview);
  if (!context) return false;

  queueEmailJob({
    type,
    payload: {
      interviewId: interview.id,
      candidateId: interview.candidateId || null,
      recipient: context.candidate.email,
      ...payload,
    },
    handler: async () => {
      await send(context);
      logger.info(`${logLabel} email sent to ${context.candidate.email}`);
    },
  });

  return true;
};

const normalizeSchedulingStrategy = (value, { hasScheduledFor = false, hasPendingRequest = false } = {}) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (INTERVIEW_SCHEDULING_STRATEGIES.has(normalized)) {
    return normalized;
  }
  if (hasScheduledFor) return 'MANUAL';
  if (hasPendingRequest) return 'PREFERRED_FIRST';
  return 'AUTO';
};

const getSlotValidationErrorCode = (reasonCodes = []) => {
  if (!Array.isArray(reasonCodes) || reasonCodes.length === 0) {
    return 'INVALID_SCHEDULE_SLOT';
  }
  if (reasonCodes.includes('PAST_DATE')) return 'SLOT_IN_PAST';
  if (reasonCodes.includes('CONFLICT')) return 'SLOT_CONFLICT';
  if (reasonCodes.includes('TOO_SOON')) return 'SLOT_TOO_SOON';
  if (reasonCodes.includes('OUTSIDE_WINDOW')) return 'SLOT_OUTSIDE_WINDOW';
  if (
    reasonCodes.includes('NON_WORKING_DAY')
    || reasonCodes.includes('OUTSIDE_BUSINESS_HOURS')
    || reasonCodes.includes('DAILY_LIMIT_REACHED')
  ) {
    return 'SLOT_OUTSIDE_AVAILABILITY';
  }
  return 'INVALID_SCHEDULE_SLOT';
};

const getSlotValidationErrorMessage = (reasonCodes = []) => {
  const code = getSlotValidationErrorCode(reasonCodes);
  switch (code) {
    case 'SLOT_IN_PAST':
      return 'Selected interview time must be in the future.';
    case 'SLOT_CONFLICT':
      return 'Selected interview time conflicts with another scheduled interview.';
    case 'SLOT_TOO_SOON':
      return 'Selected interview time is too soon based on minimum notice settings.';
    case 'SLOT_OUTSIDE_WINDOW':
      return 'Selected interview time is outside the scheduling window.';
    case 'SLOT_OUTSIDE_AVAILABILITY':
      return 'Selected interview time is outside configured working days/hours or daily limits.';
    default:
      return 'Selected interview time does not meet scheduling constraints.';
  }
};

const buildSchedulingContextError = ({
  status = 503,
  error = 'Scheduling context is unavailable right now.',
  code = 'SCHEDULING_CONTEXT_UNAVAILABLE',
  details = null,
} = {}) => ({
  ok: false,
  status,
  error,
  code,
  ...(details ? { details } : {}),
});

const buildSchedulingConstraints = (schedulingContext) => {
  const settings = schedulingContext?.settings;
  if (!settings) return null;
  return {
    timezone: settings.timezone,
    leadHours: settings.leadHours,
    slotMinutes: settings.slotMinutes,
    scheduleWindowDays: settings.scheduleWindowDays,
    durationMinutes: settings.durationMinutes,
    workingDays: Array.isArray(settings.workingDays) ? [...settings.workingDays] : [],
    businessHoursStartMinutes: settings.businessHoursStartMinutes,
    businessHoursEndMinutes: settings.businessHoursEndMinutes,
    maxInterviewsPerDay: settings.maxInterviewsPerDay,
    conflictScope: settings.conflictScope || null,
    availabilitySource: settings.availabilitySource || null,
    assignedRecruiterId: schedulingContext?.assignedRecruiterId || null,
    assignedRecruiterName: schedulingContext?.assignedRecruiter?.fullName
      || schedulingContext?.assignedRecruiter?.displayName
      || schedulingContext?.assignedRecruiter?.companyName
      || null,
  };
};

const loadSchedulingContextEntity = async ({
  loader,
  label,
  status = 503,
  error,
  code = 'SCHEDULING_CONTEXT_UNAVAILABLE',
  details = null,
} = {}) => {
  try {
    return {
      ok: true,
      value: await loader(),
    };
  } catch (loadError) {
    logger.warn(`Failed to load ${label} for interview scheduling:`, loadError);
    return buildSchedulingContextError({
      status,
      error,
      code,
      details,
    });
  }
};

const resolveSchedulingCandidates = async ({
  interview,
  settings,
  recruiterId,
  interviewIdToExclude = null,
} = {}) => {
  if (!interview || !settings) {
    return { ok: true, interviews: [] };
  }

  let interviews = [];
  try {
    if (settings.conflictScope === 'ORGANIZATION' || !recruiterId) {
      interviews = await interviewStore.listByOrganization(interview.organizationId, { limit: 250 });
    } else {
      interviews = await interviewStore.listByCompany(recruiterId, { limit: 250 });
    }
  } catch (error) {
    logger.warn('Failed to load scheduling candidates for interview availability checks:', error);
    return buildSchedulingContextError({
      status: 503,
      error: 'Unable to load current interview availability right now. Please try again.',
      code: 'SCHEDULING_CONTEXT_UNAVAILABLE',
      details: {
        step: 'LOAD_EXISTING_INTERVIEWS',
      },
    });
  }

  return {
    ok: true,
    interviews: interviews.filter((entry) => (
      entry
      && entry.id
      && entry.id !== interviewIdToExclude
      && isNonTerminalScheduledInterview(entry)
    )),
  };
};

const resolveHiringSchedulingContext = async ({
  interview,
  user,
  includeExistingInterviews = true,
} = {}) => {
  if (!isHiringInterview(interview) || String(user?.accountType || '').toUpperCase() !== 'COMPANY') {
    return {
      ok: true,
      settings: null,
      recruiterId: null,
      existingInterviews: [],
      assignedRecruiterId: null,
      assignedRecruiter: null,
    };
  }

  const assignedRecruiterId = typeof interview?.companyId === 'string' && interview.companyId.trim()
    ? interview.companyId.trim()
    : null;

  const organizationResult = interview?.organizationId
    ? await loadSchedulingContextEntity({
      loader: () => organizationStore.getById(interview.organizationId),
      label: 'organization scheduling settings',
      error: 'Unable to load organization scheduling settings for this interview right now.',
      details: {
        step: 'LOAD_ORGANIZATION',
      },
    })
    : { ok: true, value: null };
  if (!organizationResult.ok) {
    return organizationResult;
  }
  const organization = organizationResult.value;

  if (!organization) {
    return buildSchedulingContextError({
      status: 503,
      error: 'Unable to load organization scheduling settings for this interview right now.',
      code: 'SCHEDULING_CONTEXT_UNAVAILABLE',
      details: {
        step: 'LOAD_ORGANIZATION',
      },
    });
  }

  const jobResult = interview?.jobId
    ? await loadSchedulingContextEntity({
      loader: () => jobStore.getById(interview.jobId),
      label: 'job interview settings',
      error: 'Unable to load interview configuration for this job right now.',
      details: {
        step: 'LOAD_JOB',
      },
    })
    : { ok: true, value: null };
  if (!jobResult.ok) {
    return jobResult;
  }
  const job = jobResult.value;

  const assignedRecruiterResult = assignedRecruiterId
    ? await loadSchedulingContextEntity({
      loader: () => userStore.getById(assignedRecruiterId),
      label: 'assigned recruiter availability',
      error: 'Unable to load recruiter availability for this interview right now.',
      details: {
        step: 'LOAD_ASSIGNED_RECRUITER',
        assignedRecruiterId,
      },
    })
    : { ok: true, value: null };
  if (!assignedRecruiterResult.ok) {
    return assignedRecruiterResult;
  }
  const assignedRecruiter = assignedRecruiterResult.value;
  if (assignedRecruiterId && !assignedRecruiter) {
    return buildSchedulingContextError({
      status: 409,
      error: 'Assign a valid recruiter before scheduling this interview.',
      code: 'ASSIGNED_RECRUITER_REQUIRED',
      details: {
        step: 'LOAD_ASSIGNED_RECRUITER',
        assignedRecruiterId,
      },
    });
  }

  const settings = resolveInterviewAutomationSettings(organization, job, assignedRecruiter, {
    forceAutoSchedule: true,
  });
  const recruiterId = assignedRecruiterId || null;
  if (settings.conflictScope === 'RECRUITER' && !recruiterId) {
    return buildSchedulingContextError({
      status: 409,
      error: 'Assign a recruiter before scheduling this interview.',
      code: 'ASSIGNED_RECRUITER_REQUIRED',
      details: {
        conflictScope: settings.conflictScope,
      },
    });
  }

  let existingInterviews = [];
  if (includeExistingInterviews) {
    const schedulingCandidates = await resolveSchedulingCandidates({
      interview,
      settings,
      recruiterId,
      interviewIdToExclude: interview.id,
    });
    if (!schedulingCandidates.ok) {
      return schedulingCandidates;
    }
    existingInterviews = schedulingCandidates.interviews;
  }

  return {
    ok: true,
    settings,
    recruiterId,
    existingInterviews,
    assignedRecruiterId: recruiterId,
    assignedRecruiter,
  };
};

const attachSchedulingConstraints = async (interview, user) => {
  if (!interview || String(user?.accountType || '').toUpperCase() !== 'COMPANY') {
    return interview;
  }
  const schedulingContext = await resolveHiringSchedulingContext({
    interview,
    user,
    includeExistingInterviews: false,
  });
  return {
    ...interview,
    schedulingConstraints: schedulingContext.ok
      ? buildSchedulingConstraints(schedulingContext)
      : null,
    schedulingConstraintsError: schedulingContext.ok
      ? null
      : {
        code: schedulingContext.code || 'SCHEDULING_CONTEXT_UNAVAILABLE',
        message: schedulingContext.error,
      },
  };
};

const resolveScheduledForFromStrategy = ({
  strategy,
  scheduledFor,
  preferredSlots = [],
  schedulingContext,
  durationMinutes,
  demoBypassAvailability = false,
} = {}) => {
  if (strategy === 'MANUAL' && demoBypassAvailability === true) {
    const normalizedManual = new Date(scheduledFor);
    if (Number.isNaN(normalizedManual.getTime())) {
      return {
        ok: false,
        status: 400,
        error: 'scheduledFor is required and must be a valid datetime',
        code: 'INVALID_SCHEDULE_SLOT',
      };
    }
    if (normalizedManual.getTime() <= Date.now()) {
      return {
        ok: false,
        status: 409,
        error: 'Selected interview time must be in the future.',
        code: 'SLOT_IN_PAST',
      };
    }
    return {
      ok: true,
      scheduledFor: normalizedManual.toISOString(),
      scheduleDecision: {
        strategy,
        source: 'DEMO_BYPASS',
        reasonCodes: ['DEMO_BYPASS_AVAILABILITY'],
      },
    };
  }

  if (!schedulingContext?.settings) {
    const normalizedManual = new Date(scheduledFor);
    if (Number.isNaN(normalizedManual.getTime())) {
      return {
        ok: false,
        status: 400,
        error: 'scheduledFor is required and must be a valid datetime',
        code: 'INVALID_SCHEDULE_SLOT',
      };
    }
    if (normalizedManual.getTime() <= Date.now()) {
      return {
        ok: false,
        status: 409,
        error: 'Selected interview time must be in the future.',
        code: 'SLOT_IN_PAST',
      };
    }
    return {
      ok: true,
      scheduledFor: normalizedManual.toISOString(),
      scheduleDecision: {
        strategy,
        source: 'MANUAL',
      },
    };
  }

  const { settings, existingInterviews } = schedulingContext;
  const parsedDuration = Number.parseInt(durationMinutes, 10);
  const effectiveDurationMinutes = Number.isFinite(parsedDuration)
    ? Math.min(180, Math.max(15, parsedDuration))
    : settings.durationMinutes;
  const effectiveSettings = effectiveDurationMinutes !== settings.durationMinutes
    ? { ...settings, durationMinutes: effectiveDurationMinutes }
    : settings;

  if (strategy === 'MANUAL') {
    const evaluation = evaluateSlotAgainstInterviewAutomation({
      scheduledFor,
      settings: effectiveSettings,
      existingInterviews,
    });
    if (!evaluation.isValid) {
      const code = getSlotValidationErrorCode(evaluation.reasonCodes);
      return {
        ok: false,
        status: 409,
        error: getSlotValidationErrorMessage(evaluation.reasonCodes),
        code,
        details: {
          reasonCodes: evaluation.reasonCodes,
          conflictInterviewId: evaluation.conflictInterviewId || null,
        },
      };
    }
    return {
      ok: true,
      scheduledFor: new Date(scheduledFor).toISOString(),
      scheduleDecision: {
        strategy,
        source: 'MANUAL',
        reasonCodes: [],
      },
    };
  }

  const decision = selectSlotFromPreferredOrAuto({
    strategy,
    preferredSlots,
    settings: effectiveSettings,
    existingInterviews,
  });
  if (!decision?.scheduledFor) {
    return {
      ok: false,
      status: 409,
      error: 'No available interview slots matched availability constraints. Try widening working hours or scheduling window.',
      code: 'NO_SLOT_AVAILABLE',
      details: {
        strategy,
        preferredSlotEvaluations: decision?.preferredSlotEvaluations || [],
      },
    };
  }

  return {
    ok: true,
    scheduledFor: decision.scheduledFor,
    scheduleDecision: {
      strategy,
      source: decision.source || 'AUTO_EARLIEST',
      preferredSlotEvaluations: decision.preferredSlotEvaluations || [],
      slotSearch: decision.slotSearch || null,
    },
  };
};

export class InterviewController {
  static async createInterview(req, res, next) {
    try {
      const {
        mode,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
        jobId,
        jobStage,
        config,
        candidateId,
        status,
        pipelineStatus,
        reviewerAssignments,
        scheduledFor,
        timezone,
        scheduleStatus,
      } = req.body;
      const hasReviewerAssignmentsOverride = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'reviewerAssignments',
      );
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationContext = req.user.organizationContext || null;
      const organizationId = organizationContext?.organization?.id || null;
      const organizationStatus = String(organizationContext?.organization?.status || '').toUpperCase();
      const organizationRole = String(organizationContext?.membership?.role || '').toUpperCase();
      const normalizedMode = String(mode || '').toUpperCase();
      const normalizedCandidateId = typeof candidateId === 'string' ? candidateId.trim() : null;
      const normalizedScheduledFor = scheduledFor || null;
      if (normalizedScheduledFor && !isFutureDateTime(normalizedScheduledFor)) {
        return res.status(400).json({
          error: 'scheduledFor must be in the future',
          code: 'SLOT_IN_PAST',
        });
      }
      const defaultInterviewStatus = normalizedMode === 'HIRING' && !normalizedScheduledFor
        ? 'PENDING'
        : 'SCHEDULED';
      let systemSettings = null;

      if (normalizedMode === 'PRACTICE' && accountType !== 'CANDIDATE') {
        return res.status(403).json({ error: 'Only candidates can create practice interviews' });
      }

      if (normalizedMode === 'HIRING' && accountType !== 'COMPANY') {
        return res.status(403).json({ error: 'Only companies can create hiring interviews' });
      }

      if (normalizedMode === 'HIRING' && !organizationId) {
        return res.status(400).json({ error: 'Organization context required for hiring interviews' });
      }

      if (normalizedMode === 'HIRING' && organizationStatus !== 'APPROVED') {
        return res.status(403).json({
          error: 'Organization approval is required to create hiring interviews',
          code: 'ORG_APPROVAL_REQUIRED',
        });
      }

      if (normalizedMode === 'HIRING' && !canCreateHiringInterview(organizationRole)) {
        return res.status(403).json({
          error: 'Insufficient organization permissions to create hiring interviews',
          code: 'INSUFFICIENT_ORG_PERMISSIONS',
        });
      }

      if (normalizedMode === 'HIRING' && !normalizedCandidateId) {
        return res.status(400).json({
          error: 'candidateId is required for hiring interviews',
          code: 'HIRING_CANDIDATE_REQUIRED',
        });
      }

      let mergedInterviewConfig = null;
      let validatedReviewerAssignments = [];
      if (config || normalizedMode === 'PRACTICE' || normalizedMode === 'HIRING') {
        try {
          systemSettings = await systemSettingsStore.get();
          mergedInterviewConfig = mergeInterviewConfigWithSystemDefaults(
            config,
            systemSettings?.defaultAIConfig,
            systemSettings?.structuredInterviewDefaults,
            normalizedMode,
          );
        } catch (settingsError) {
          logger.warn('Failed to load system AI defaults; using fallback defaults.', settingsError);
          mergedInterviewConfig = mergeInterviewConfigWithSystemDefaults(
            config,
            DEFAULT_SYSTEM_AI_CONFIG,
            null,
            normalizedMode,
          );
        }
      }

      if (normalizedMode === 'HIRING') {
        const featureFlags = systemSettings?.featureFlags || {};
        if (featureFlags.enableJobPosting === false) {
          return res.status(503).json({
            error: 'Hiring interview creation is currently disabled by system administration.',
            code: 'FEATURE_DISABLED',
            feature: 'enableJobPosting',
          });
        }
      }

      let linkedApplication = null;
      if (normalizedMode === 'HIRING') {
        const reviewerAssignmentValidation = await validateReviewerAssignmentsForOrganization({
          organizationId,
          reviewerAssignments: Array.isArray(reviewerAssignments) ? reviewerAssignments : [],
        });
        if (!reviewerAssignmentValidation.ok) {
          return res.status(reviewerAssignmentValidation.status || 400).json({
            error: reviewerAssignmentValidation.error,
            code: reviewerAssignmentValidation.code || 'INVALID_REVIEWER_ASSIGNMENTS',
            ...(reviewerAssignmentValidation.details
              ? { details: reviewerAssignmentValidation.details }
              : {}),
          });
        }
        validatedReviewerAssignments = reviewerAssignmentValidation.reviewerAssignments;

        const candidateProfile = await userStore.getById(normalizedCandidateId);
        if (!candidateProfile) {
          return res.status(404).json({
            error: 'Candidate not found',
            code: 'CANDIDATE_NOT_FOUND',
          });
        }
        if (String(candidateProfile.accountType || '').toUpperCase() !== 'CANDIDATE') {
          return res.status(400).json({
            error: 'candidateId must belong to a candidate account',
            code: 'INVALID_HIRING_CANDIDATE',
          });
        }

        if (jobId) {
          const job = await jobStore.getById(jobId);
          if (!job) {
            return res.status(404).json({
              error: 'Job not found',
              code: 'JOB_NOT_FOUND',
            });
          }
          if (job.organizationId !== organizationId) {
            return res.status(403).json({
              error: 'Job does not belong to your organization',
              code: 'JOB_ORG_MISMATCH',
            });
          }

          linkedApplication = await jobApplicationStore.checkDuplicate(jobId, normalizedCandidateId);
          if (!linkedApplication) {
            return res.status(409).json({
              error: 'Candidate must have an application before creating a hiring interview',
              code: 'APPLICATION_REQUIRED',
            });
          }

          if (linkedApplication) {
            const linkedStatus = normalizeApplicationStatus(linkedApplication.status);
            if (linkedStatus !== 'INTERVIEWING') {
              return res.status(409).json({
                error: `Application must be in INTERVIEWING before creating an interview. Current status: ${linkedStatus || 'UNKNOWN'}.`,
                code: 'APPLICATION_NOT_READY_FOR_INTERVIEW',
                details: {
                  applicationId: linkedApplication.id,
                  currentStatus: linkedStatus,
                  requiredStatus: 'INTERVIEWING',
                },
              });
            }
          }

          const jobInterviews = await interviewStore.listByJob(jobId, { limit: 200 });
          const existingActiveInterview = jobInterviews.find((interview) =>
            interview.candidateId === normalizedCandidateId
            && !isTerminalInterviewStatus(interview.status),
          );
          if (existingActiveInterview) {
            if (linkedApplication && linkedApplication.interviewId !== existingActiveInterview.id) {
              await jobApplicationStore.update(linkedApplication.id, {
                interviewId: existingActiveInterview.id,
              });
            }
            const hydratedExisting = await attachSingleInterviewParticipants(existingActiveInterview);
            return res.json({
              success: true,
              interview: sanitizeInterviewForClient(hydratedExisting),
              message: 'Existing active interview found',
              reusedExistingInterview: true,
            });
          }
        }
      }

      // For HIRING mode, use provided candidateId.
      // For PRACTICE mode, use the current user's ID.
      const finalCandidateId = normalizedMode === 'PRACTICE' ? userId : normalizedCandidateId;
      const initialReviewRequests = normalizedMode === 'HIRING'
        ? syncReviewRequests({
          existingReviewRequests: [],
          reviewerAssignments: hasReviewerAssignmentsOverride || normalizedMode === 'HIRING'
            ? validatedReviewerAssignments
            : [],
          assignedBy: userId,
          interview: {
            scheduledFor: normalizedScheduledFor,
            completedAt: null,
            duration,
          },
        })
        : [];

      const interview = await interviewStore.create({
        mode: normalizedMode,
        candidateId: finalCandidateId,
        companyId: normalizedMode === 'HIRING' ? userId : null,
        organizationId: normalizedMode === 'HIRING' ? organizationId : null,
        jobId: jobId || null,
        jobStage: jobStage || null,
        invitationId: null,
        status: status || defaultInterviewStatus,
        scheduledFor: normalizedScheduledFor,
        timezone: timezone || DEFAULT_TIMEZONE,
        ...(normalizedScheduledFor ? generateMeetingToken() : {}),
        scheduleStatus: scheduleStatus || (normalizedScheduledFor ? 'SCHEDULED' : null),
        scheduledBy: normalizedScheduledFor ? userId : null,
        scheduledAt: normalizedScheduledFor ? new Date().toISOString() : null,
        pipelineStatus: pipelineStatus || null,
        reviewerAssignments: hasReviewerAssignmentsOverride || normalizedMode === 'HIRING'
          ? validatedReviewerAssignments
          : [],
        reviewRequests: initialReviewRequests,
        jobRole,
        experienceLevel,
        industry,
        interviewTypes,
        skillFocus,
        duration,
        config: mergedInterviewConfig || null, // Store full config object (personality, voice, interviewerName, advancedSettings)
      });

      if (normalizedMode === 'HIRING' && linkedApplication) {
        const nextApplicationStatus = normalizeApplicationStatus(linkedApplication.status);
        const shouldPromoteToInterviewing = nextApplicationStatus !== 'INTERVIEWING';
        const statusChangedAt = new Date().toISOString();

        await jobApplicationStore.update(linkedApplication.id, {
          interviewId: interview.id,
          ...(shouldPromoteToInterviewing
            ? {
              status: 'INTERVIEWING',
              reviewedAt: statusChangedAt,
              reviewedBy: userId,
              statusSource: 'INTERVIEW_CREATED',
              statusChangedAt,
              dispositionCode: null,
              dispositionCategory: null,
              dispositionReason: null,
              dispositionNotes: null,
              dispositionTags: [],
              dispositionAt: null,
              dispositionBy: null,
              statusHistory: appendStatusHistory(
                linkedApplication.statusHistory,
                buildStatusHistoryEntry({
                  previousStatus: linkedApplication.status,
                  status: 'INTERVIEWING',
                  changedAt: statusChangedAt,
                  changedBy: userId,
                  source: 'INTERVIEW_CREATED',
                  note: 'Application moved to interviewing during interview creation.',
                }),
              ),
            }
            : {}),
        });
      }

      const hydrated = await attachSingleInterviewParticipants({ ...interview, questions: [] });

      try {
        await recordRealtimeEvent(interview.id, 'interview-created', {
          actor: userId,
          status: interview.status || 'SCHEDULED',
          mode: interview.mode || null,
        });
        if (interview.organizationId) {
          await publishOrganizationRealtimeUpdate(interview.organizationId, 'interview-created', {
            interviewId: interview.id,
            status: interview.status || 'SCHEDULED',
            candidateId: interview.candidateId || null,
            companyId: interview.companyId || null,
            jobId: interview.jobId || null,
          });
        }
        if (interview.candidateId) {
          await publishCandidateRealtimeUpdate(interview.candidateId, 'interview-created', {
            interviewId: interview.id,
            status: interview.status || 'SCHEDULED',
            organizationId: interview.organizationId || null,
            jobId: interview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-created realtime event:', eventError);
      }

      if (interview.scheduledFor) {
        await queueHiringInterviewEmail({
          type: 'INTERVIEW_SCHEDULED',
          interview,
          payload: { operation: 'CREATE_INTERVIEW' },
          send: async ({ candidate, job, organization }) =>
            emailNotifications.sendInterviewScheduled(interview, candidate, job, organization),
          logLabel: 'Interview scheduled',
        });
      }

      res.status(201).json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
      });
    } catch (error) {
      logger.error('Create interview error:', error);
      next(error);
    }
  }

  static async getInterview(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (!isTerminalInterviewStatus(interview?.status)) {
        const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req, {
          requireActiveWindow: true,
        });
        if (!tokenAccess.allowed) {
          return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
        }
      }

      const hydrated = await attachSingleInterviewParticipants(interview);
      const interviewWithReviewState = (await attachReviewerQueueState([hydrated], req.user))[0] || hydrated;
      const interviewWithPlan = (await attachInterviewPlanContext([interviewWithReviewState]))[0] || interviewWithReviewState;
      const interviewWithConstraints = await attachSchedulingConstraints(interviewWithPlan, req.user);

      res.json({ success: true, interview: sanitizeInterviewForClient(interviewWithConstraints) });
    } catch (error) {
      logger.error('Get interview error:', error);
      next(error);
    }
  }

  static async validateMeetingLink(req, res, next) {
    try {
      const { id } = req.params;
      const { token } = req.query;
      if (!token) {
        return res.status(400).json({ error: 'Meeting token is required.', code: 'MISSING_TOKEN' });
      }
      const interview = await interviewStore.getById(id);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found.', code: 'NOT_FOUND' });
      }
      if (req.user?.accountType === 'CANDIDATE' && interview.candidateId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to access this interview.', code: 'FORBIDDEN' });
      }

      const result = validateMeetingAccess(interview, token);
      if (!result.valid) {
        return res.status(403).json({ error: result.message, code: result.code });
      }

      const hydrated = await attachSingleInterviewParticipants(interview);
      return res.json({ success: true, interview: sanitizeInterviewForClient(hydrated) });
    } catch (error) {
      logger.error('Validate meeting link error:', error);
      return next(error);
    }
  }

  /**
   * Record explicit consent for recording (audio/video) for this interview.
   * FR2: Consent and user controls for recorded text/audio/video.
   */
  static async recordRecordingConsent(req, res, next) {
    try {
      const { id } = req.params;
      const { recordingConsentGivenAt, recordingConsentVersion } = req.body;
      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req, { requireActiveWindow: true });
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      await interviewStore.update(id, {
        recordingConsentGivenAt: recordingConsentGivenAt || new Date().toISOString(),
        recordingConsentVersion: recordingConsentVersion || null,
      });

      res.json({
        success: true,
        message: 'Recording consent recorded',
      });
    } catch (error) {
      logger.error('Record recording consent error:', error);
      next(error);
    }
  }

  static async scheduleInterview(req, res, next) {
    try {
      const { id } = req.params;
      const {
        scheduledFor,
        timezone,
        duration,
        interviewTypes,
        notes,
        strategy,
        reviewerAssignments,
        demoBypassAvailability,
      } = req.body;
      const hasReviewerAssignmentsOverride = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'reviewerAssignments',
      );
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (isTerminalInterviewStatus(interview.status)) {
        return res.status(409).json({ error: 'Cannot schedule a completed or cancelled interview' });
      }

      const schedulingContext = await resolveHiringSchedulingContext({
        interview,
        user: req.user,
      });
      const schedulingStrategy = normalizeSchedulingStrategy(strategy, {
        hasScheduledFor: Boolean(scheduledFor),
      });
      if (schedulingStrategy === 'MANUAL' && !scheduledFor) {
        return res.status(400).json({
          error: 'scheduledFor is required when using manual scheduling.',
          code: 'SCHEDULED_FOR_REQUIRED',
        });
      }
      if (!schedulingContext.ok) {
        return res.status(schedulingContext.status || 503).json({
          error: schedulingContext.error,
          code: schedulingContext.code || 'SCHEDULING_CONTEXT_UNAVAILABLE',
          ...(schedulingContext.details ? { details: schedulingContext.details } : {}),
        });
      }

      let validatedReviewerAssignments = null;
      if (hasReviewerAssignmentsOverride) {
        const reviewerAssignmentValidation = await validateReviewerAssignmentsForOrganization({
          organizationId: interview.organizationId,
          reviewerAssignments,
        });
        if (!reviewerAssignmentValidation.ok) {
          return res.status(reviewerAssignmentValidation.status || 400).json({
            error: reviewerAssignmentValidation.error,
            code: reviewerAssignmentValidation.code || 'INVALID_REVIEWER_ASSIGNMENTS',
            ...(reviewerAssignmentValidation.details
              ? { details: reviewerAssignmentValidation.details }
              : {}),
          });
        }
        validatedReviewerAssignments = reviewerAssignmentValidation.reviewerAssignments;
      }
      const nextReviewerAssignments = hasReviewerAssignmentsOverride
        ? validatedReviewerAssignments
        : (Array.isArray(interview?.reviewerAssignments) ? interview.reviewerAssignments : []);

      const slotResolution = resolveScheduledForFromStrategy({
        strategy: schedulingStrategy,
        scheduledFor,
        preferredSlots: [],
        schedulingContext,
        durationMinutes: duration || interview?.duration,
        demoBypassAvailability: demoBypassAvailability === true,
      });
      if (!slotResolution.ok) {
        return res.status(slotResolution.status || 409).json({
          error: slotResolution.error,
          code: slotResolution.code || 'SCHEDULING_FAILED',
          ...(slotResolution.details ? { details: slotResolution.details } : {}),
        });
      }

      const scheduledAt = new Date().toISOString();
      const meetingTokenData = generateMeetingToken();
      const nextReviewRequests = syncReviewRequests({
        existingReviewRequests: interview?.reviewRequests,
        reviewerAssignments: nextReviewerAssignments,
        assignedBy: req.user.id,
        interview: {
          ...interview,
          scheduledFor: slotResolution.scheduledFor,
          duration: Number.isFinite(Number(duration)) ? Number(duration) : interview?.duration,
        },
        nowValue: scheduledAt,
      });
      const updatedInterview = await interviewStore.update(id, {
        status: 'SCHEDULED',
        scheduledFor: slotResolution.scheduledFor,
        timezone: timezone || schedulingContext?.settings?.timezone || interview.timezone || DEFAULT_TIMEZONE,
        ...meetingTokenData,
        ...(Number.isFinite(Number(duration)) ? { duration: Number(duration) } : {}),
        ...(Array.isArray(interviewTypes) ? { interviewTypes } : {}),
        ...(typeof notes === 'string' ? { scheduleNote: notes.trim() || null } : {}),
        scheduleStatus: 'SCHEDULED',
        scheduledBy: req.user.id,
        scheduledAt,
        scheduleDecision: slotResolution.scheduleDecision || null,
        schedulingStrategy,
        availabilitySource: schedulingContext?.settings?.availabilitySource || null,
        conflictScope: schedulingContext?.settings?.conflictScope || null,
        reviewerAssignments: nextReviewerAssignments,
        reviewRequests: nextReviewRequests,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_SCHEDULED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            scheduledFor: updatedInterview.scheduledFor || null,
            timezone: updatedInterview.timezone || null,
            duration: updatedInterview.duration || null,
            schedulingStrategy,
            scheduleDecision: slotResolution.scheduleDecision || null,
            demoBypassAvailability: demoBypassAvailability === true,
            availabilitySource: schedulingContext?.settings?.availabilitySource || null,
            conflictScope: schedulingContext?.settings?.conflictScope || null,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-scheduled', {
          actor: req.user.id,
          status: 'SCHEDULED',
          scheduledFor: updatedInterview.scheduledFor || null,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-scheduled', {
            interviewId: updatedInterview.id,
            status: 'SCHEDULED',
            scheduledFor: updatedInterview.scheduledFor || null,
            candidateId: updatedInterview.candidateId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'interview-scheduled', {
            interviewId: updatedInterview.id,
            status: 'SCHEDULED',
            scheduledFor: updatedInterview.scheduledFor || null,
            organizationId: updatedInterview.organizationId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-scheduled realtime event:', eventError);
      }

      await queueHiringInterviewEmail({
        type: 'INTERVIEW_SCHEDULED',
        interview: updatedInterview,
        payload: { operation: 'SCHEDULE_INTERVIEW' },
        send: async ({ candidate, job, organization }) =>
          emailNotifications.sendInterviewScheduled(updatedInterview, candidate, job, organization),
        logLabel: 'Interview scheduled',
      });

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({ success: true, interview: sanitizeInterviewForClient(hydrated) });
    } catch (error) {
      logger.error('Schedule interview error:', error);
      return next(error);
    }
  }

  static async rescheduleInterview(req, res, next) {
    try {
      const { id } = req.params;
      const {
        scheduledFor,
        timezone,
        duration,
        interviewTypes,
        notes,
        rescheduleRequestId,
        rescheduleDecisionNote,
        strategy,
        reviewerAssignments,
        demoBypassAvailability,
      } = req.body;
      const hasReviewerAssignmentsOverride = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'reviewerAssignments',
      );
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (isTerminalInterviewStatus(interview.status)) {
        return res.status(409).json({ error: 'Cannot reschedule a completed or cancelled interview' });
      }

      const normalizedRequests = normalizeRescheduleRequests(interview?.rescheduleRequests);
      const pendingRequest = rescheduleRequestId
        ? normalizedRequests.find((request) => request.id === rescheduleRequestId) || null
        : getPendingRescheduleRequest({ rescheduleRequests: normalizedRequests });
      if (rescheduleRequestId && !pendingRequest) {
        return res.status(404).json({ error: 'Reschedule request not found for this interview' });
      }

      const schedulingContext = await resolveHiringSchedulingContext({
        interview,
        user: req.user,
      });
      const schedulingStrategy = normalizeSchedulingStrategy(strategy, {
        hasScheduledFor: Boolean(scheduledFor),
        hasPendingRequest: Boolean(pendingRequest),
      });
      if (schedulingStrategy === 'MANUAL' && !scheduledFor) {
        return res.status(400).json({
          error: 'scheduledFor is required when using manual scheduling.',
          code: 'SCHEDULED_FOR_REQUIRED',
        });
      }
      if (!schedulingContext.ok) {
        return res.status(schedulingContext.status || 503).json({
          error: schedulingContext.error,
          code: schedulingContext.code || 'SCHEDULING_CONTEXT_UNAVAILABLE',
          ...(schedulingContext.details ? { details: schedulingContext.details } : {}),
        });
      }

      let validatedReviewerAssignments = null;
      if (hasReviewerAssignmentsOverride) {
        const reviewerAssignmentValidation = await validateReviewerAssignmentsForOrganization({
          organizationId: interview.organizationId,
          reviewerAssignments,
        });
        if (!reviewerAssignmentValidation.ok) {
          return res.status(reviewerAssignmentValidation.status || 400).json({
            error: reviewerAssignmentValidation.error,
            code: reviewerAssignmentValidation.code || 'INVALID_REVIEWER_ASSIGNMENTS',
            ...(reviewerAssignmentValidation.details
              ? { details: reviewerAssignmentValidation.details }
              : {}),
          });
        }
        validatedReviewerAssignments = reviewerAssignmentValidation.reviewerAssignments;
      }
      const nextReviewerAssignments = hasReviewerAssignmentsOverride
        ? validatedReviewerAssignments
        : (Array.isArray(interview?.reviewerAssignments) ? interview.reviewerAssignments : []);

      const preferredSlots = schedulingStrategy === 'PREFERRED_FIRST'
        ? (pendingRequest?.preferredSlots || [])
        : [];
      const slotResolution = resolveScheduledForFromStrategy({
        strategy: schedulingStrategy,
        scheduledFor,
        preferredSlots,
        schedulingContext,
        durationMinutes: duration || interview?.duration,
        demoBypassAvailability: demoBypassAvailability === true,
      });
      if (!slotResolution.ok) {
        return res.status(slotResolution.status || 409).json({
          error: slotResolution.error,
          code: slotResolution.code || 'SCHEDULING_FAILED',
          ...(slotResolution.details ? { details: slotResolution.details } : {}),
        });
      }

      const scheduledAt = new Date().toISOString();
      let nextRequests = normalizedRequests;
      let approvedRequestId = null;
      const approverId = req.user.id;
      const decisionNote = typeof rescheduleDecisionNote === 'string' && rescheduleDecisionNote.trim()
        ? rescheduleDecisionNote.trim()
        : (typeof notes === 'string' && notes.trim() ? notes.trim() : null);

      if (rescheduleRequestId) {
        nextRequests = normalizedRequests.map((request) => {
          if (request.id !== rescheduleRequestId) return request;
          if (request.status !== 'PENDING') return request;
          approvedRequestId = request.id;
          return {
            ...request,
            status: 'APPROVED',
            reviewedAt: scheduledAt,
            reviewedBy: approverId,
            reviewNote: decisionNote || request.reviewNote || null,
            decisionSource: 'COMPANY_RESCHEDULED',
          };
        });
      } else {
        // If company reschedules while a pending request exists, auto-approve the latest pending request.
        for (let index = nextRequests.length - 1; index >= 0; index -= 1) {
          if (nextRequests[index].status === 'PENDING') {
            approvedRequestId = nextRequests[index].id;
            nextRequests[index] = {
              ...nextRequests[index],
              status: 'APPROVED',
              reviewedAt: scheduledAt,
              reviewedBy: approverId,
              reviewNote: decisionNote || nextRequests[index].reviewNote || null,
              decisionSource: 'AUTO_APPROVED_ON_RESCHEDULE',
            };
            break;
          }
        }
      }

      const rescheduleTokenData = generateMeetingToken();
      const nextReviewRequests = syncReviewRequests({
        existingReviewRequests: interview?.reviewRequests,
        reviewerAssignments: nextReviewerAssignments,
        assignedBy: req.user.id,
        interview: {
          ...interview,
          scheduledFor: slotResolution.scheduledFor,
          duration: Number.isFinite(Number(duration)) ? Number(duration) : interview?.duration,
        },
        nowValue: scheduledAt,
      });
      const updatedInterview = await interviewStore.update(id, {
        status: 'SCHEDULED',
        scheduledFor: slotResolution.scheduledFor,
        timezone: timezone || schedulingContext?.settings?.timezone || interview.timezone || DEFAULT_TIMEZONE,
        ...rescheduleTokenData,
        ...(Number.isFinite(Number(duration)) ? { duration: Number(duration) } : {}),
        ...(Array.isArray(interviewTypes) ? { interviewTypes } : {}),
        ...(typeof notes === 'string' ? { scheduleNote: notes.trim() || null } : {}),
        scheduleStatus: 'RESCHEDULED',
        scheduledBy: req.user.id,
        scheduledAt,
        rescheduleRequests: nextRequests,
        scheduleDecision: slotResolution.scheduleDecision || null,
        schedulingStrategy,
        availabilitySource: schedulingContext?.settings?.availabilitySource || null,
        conflictScope: schedulingContext?.settings?.conflictScope || null,
        ...(approvedRequestId
          ? {
            rescheduleRequestStatus: 'RESOLVED',
            lastResolvedRescheduleRequestId: approvedRequestId,
            lastResolvedRescheduleRequestAt: scheduledAt,
          }
          : {}),
        reviewerAssignments: nextReviewerAssignments,
        reviewRequests: nextReviewRequests,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_RESCHEDULED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            scheduledFor: updatedInterview.scheduledFor || null,
            timezone: updatedInterview.timezone || null,
            duration: updatedInterview.duration || null,
            rescheduleRequestId: approvedRequestId,
            schedulingStrategy,
            scheduleDecision: slotResolution.scheduleDecision || null,
            demoBypassAvailability: demoBypassAvailability === true,
            availabilitySource: schedulingContext?.settings?.availabilitySource || null,
            conflictScope: schedulingContext?.settings?.conflictScope || null,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-rescheduled', {
          actor: req.user.id,
          status: 'SCHEDULED',
          scheduledFor: updatedInterview.scheduledFor || null,
          scheduleStatus: 'RESCHEDULED',
          rescheduleRequestId: approvedRequestId,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-rescheduled', {
            interviewId: updatedInterview.id,
            status: 'SCHEDULED',
            scheduledFor: updatedInterview.scheduledFor || null,
            candidateId: updatedInterview.candidateId || null,
            jobId: updatedInterview.jobId || null,
            scheduleStatus: 'RESCHEDULED',
            rescheduleRequestId: approvedRequestId,
          });
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'interview-rescheduled', {
            interviewId: updatedInterview.id,
            status: 'SCHEDULED',
            scheduledFor: updatedInterview.scheduledFor || null,
            organizationId: updatedInterview.organizationId || null,
            jobId: updatedInterview.jobId || null,
            scheduleStatus: 'RESCHEDULED',
            rescheduleRequestId: approvedRequestId,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-rescheduled realtime event:', eventError);
      }

      await queueHiringInterviewEmail({
        type: 'INTERVIEW_RESCHEDULED',
        interview: updatedInterview,
        payload: { operation: 'RESCHEDULE_INTERVIEW' },
        send: async ({ candidate, job, organization }) =>
          emailNotifications.sendInterviewRescheduled(updatedInterview, candidate, job, organization),
        logLabel: 'Interview rescheduled',
      });

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({ success: true, interview: sanitizeInterviewForClient(hydrated) });
    } catch (error) {
      logger.error('Reschedule interview error:', error);
      return next(error);
    }
  }

  static async updateInterviewReviewRequests(req, res, next) {
    try {
      const { id } = req.params;
      const {
        reviewerAssignments,
        reviewRequestUpdates,
      } = req.body;
      const hasReviewerAssignmentsOverride = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'reviewerAssignments',
      );
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (String(interview?.mode || '').toUpperCase() !== 'HIRING') {
        return res.status(409).json({
          error: 'Review request administration is only supported for hiring interviews.',
          code: 'REVIEW_REQUESTS_NOT_SUPPORTED',
        });
      }

      let validatedReviewerAssignments = null;
      if (hasReviewerAssignmentsOverride) {
        const reviewerAssignmentValidation = await validateReviewerAssignmentsForOrganization({
          organizationId: interview.organizationId,
          reviewerAssignments,
        });
        if (!reviewerAssignmentValidation.ok) {
          return res.status(reviewerAssignmentValidation.status || 400).json({
            error: reviewerAssignmentValidation.error,
            code: reviewerAssignmentValidation.code || 'INVALID_REVIEWER_ASSIGNMENTS',
            ...(reviewerAssignmentValidation.details
              ? { details: reviewerAssignmentValidation.details }
              : {}),
          });
        }
        validatedReviewerAssignments = reviewerAssignmentValidation.reviewerAssignments;
      }

      const nextReviewerAssignments = hasReviewerAssignmentsOverride
        ? validatedReviewerAssignments
        : (Array.isArray(interview?.reviewerAssignments) ? interview.reviewerAssignments : []);

      const normalizedReviewRequestUpdates = Array.isArray(reviewRequestUpdates)
        ? reviewRequestUpdates
          .map((update) => ({
            reviewerId: typeof update?.reviewerId === 'string' ? update.reviewerId.trim() : '',
            dueSource: String(update?.dueSource || 'AUTO').trim().toUpperCase() === 'MANUAL' ? 'MANUAL' : 'AUTO',
            dueAt: update?.dueAt || null,
          }))
          .filter((update) => update.reviewerId)
        : [];

      const invalidUpdateReviewerIds = normalizedReviewRequestUpdates
        .map((update) => update.reviewerId)
        .filter((reviewerId) => !nextReviewerAssignments.includes(reviewerId));
      if (invalidUpdateReviewerIds.length > 0) {
        return res.status(400).json({
          error: 'Review request updates must target currently assigned reviewers.',
          code: 'INVALID_REVIEW_REQUEST_UPDATES',
          details: {
            invalidReviewerIds: invalidUpdateReviewerIds,
          },
        });
      }

      const missingManualDueAt = normalizedReviewRequestUpdates.find(
        (update) => update.dueSource === 'MANUAL' && !update.dueAt,
      );
      if (missingManualDueAt) {
        return res.status(400).json({
          error: 'Manual review due dates require a valid dueAt value.',
          code: 'REVIEW_DUE_AT_REQUIRED',
          details: {
            reviewerId: missingManualDueAt.reviewerId,
          },
        });
      }

      const updatedAt = new Date().toISOString();
      const synchronizedReviewRequests = syncReviewRequests({
        existingReviewRequests: interview?.reviewRequests,
        reviewerAssignments: nextReviewerAssignments,
        assignedBy: req.user.id,
        interview,
        nowValue: updatedAt,
      });
      const nextReviewRequests = applyReviewRequestUpdates({
        reviewRequests: synchronizedReviewRequests,
        reviewRequestUpdates: normalizedReviewRequestUpdates,
        interview,
      });

      const updatedInterview = await interviewStore.update(id, {
        reviewerAssignments: nextReviewerAssignments,
        reviewRequests: nextReviewRequests,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_REVIEW_REQUESTS_UPDATED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            reviewerAssignments: nextReviewerAssignments,
            manualDueOverrides: normalizedReviewRequestUpdates.filter((update) => update.dueSource === 'MANUAL').map((update) => ({
              reviewerId: update.reviewerId,
              dueAt: update.dueAt || null,
            })),
          },
        });
      }

      try {
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-review-requests-updated', {
            interviewId: updatedInterview.id,
            reviewerAssignments: nextReviewerAssignments,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-review-requests-updated realtime event:', eventError);
      }

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({ success: true, interview: sanitizeInterviewForClient(hydrated) });
    } catch (error) {
      logger.error('Update interview review requests error:', error);
      return next(error);
    }
  }

  static async sendInterviewReviewReminder(req, res, next) {
    try {
      const { id, reviewerId } = req.params;
      const normalizedReviewerId = typeof reviewerId === 'string' ? reviewerId.trim() : '';
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (String(interview?.mode || '').toUpperCase() !== 'HIRING') {
        return res.status(409).json({
          error: 'Review reminders are only supported for hiring interviews.',
          code: 'REVIEW_REMINDERS_NOT_SUPPORTED',
        });
      }

      if (!normalizedReviewerId) {
        return res.status(400).json({
          error: 'Reviewer ID is required.',
          code: 'REVIEWER_ID_REQUIRED',
        });
      }

      const effectiveReviewRequests = Array.isArray(interview?.reviewRequests) && interview.reviewRequests.length > 0
        ? interview.reviewRequests
        : syncReviewRequests({
          existingReviewRequests: [],
          reviewerAssignments: interview?.reviewerAssignments,
          assignedBy: interview?.scheduledBy || interview?.companyId || null,
          interview,
          nowValue: new Date().toISOString(),
        });
      const enrichedReviewRequests = enrichInterviewReviewRequests({
        ...interview,
        reviewRequests: effectiveReviewRequests,
      });
      const reviewRequest = (Array.isArray(enrichedReviewRequests.reviewRequestsDetailed)
        ? enrichedReviewRequests.reviewRequestsDetailed
        : []
      ).find((request) => request?.reviewerId === normalizedReviewerId) || null;

      if (!reviewRequest) {
        return res.status(404).json({
          error: 'Assigned review request not found for this reviewer.',
          code: 'REVIEW_REQUEST_NOT_FOUND',
        });
      }

      if (reviewRequest.isCompleted) {
        return res.status(409).json({
          error: 'This reviewer has already completed their feedback.',
          code: 'REVIEW_REQUEST_ALREADY_COMPLETED',
        });
      }

      if (reviewRequest.workflowState === 'WAITING_FOR_INTERVIEW') {
        return res.status(409).json({
          error: 'Manual reminders are only available after the interview is completed.',
          code: 'REVIEW_REMINDER_NOT_READY',
        });
      }

      const lastReminderMs = reviewRequest?.lastReminderAt
        ? Date.parse(reviewRequest.lastReminderAt)
        : Number.NaN;
      if (Number.isFinite(lastReminderMs)) {
        const cooldownMs = MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
        const nextAvailableAt = new Date(lastReminderMs + cooldownMs).toISOString();
        if (Date.now() < Date.parse(nextAvailableAt)) {
          return res.status(409).json({
            error: `A reminder was already sent recently. Manual reminders reopen after ${MANUAL_REVIEW_REMINDER_COOLDOWN_HOURS} hours.`,
            code: 'REVIEW_REMINDER_COOLDOWN',
            details: {
              reviewerId: normalizedReviewerId,
              nextAvailableAt,
            },
          });
        }
      }

      const [reviewer, candidate, job, organization] = await Promise.all([
        userStore.getSummary(normalizedReviewerId),
        interview?.candidateId ? userStore.getSummary(interview.candidateId) : Promise.resolve(null),
        interview?.jobId ? jobStore.getById(interview.jobId) : Promise.resolve(null),
        interview?.organizationId ? organizationStore.getById(interview.organizationId) : Promise.resolve(null),
      ]);

      if (!reviewer?.email || !organization) {
        return res.status(409).json({
          error: 'Unable to send a reminder because reviewer or organization contact context is unavailable.',
          code: 'REVIEW_REMINDER_CONTEXT_UNAVAILABLE',
        });
      }

      const workflowState = String(reviewRequest.workflowState || '').toUpperCase() || 'PENDING';
      const reviewUrl = buildAssignedReviewsUrl(interview.id);

      await emailNotifications.sendReviewRequestReminder({
        interview,
        reviewer,
        candidate,
        job,
        company: organization,
        reviewRequest,
        workflowState,
        reviewUrl,
        reminderSource: 'MANUAL',
      });

      const updatedReviewRequests = markReviewRequestReminder({
        reviewRequests: effectiveReviewRequests,
        reviewerId: normalizedReviewerId,
        remindedAt: new Date().toISOString(),
        workflowState,
        channel: 'EMAIL',
        source: 'MANUAL',
      });

      const updatedInterview = await interviewStore.update(id, {
        reviewRequests: updatedReviewRequests,
      });

      try {
        await notificationStore.create({
          userId: normalizedReviewerId,
          type: 'review_reminder',
          title: 'Review reminder',
          message: `A recruiter requested an update on your feedback for ${candidate?.fullName || 'this candidate'}.`,
          link: `/company-reviews?interviewId=${encodeURIComponent(interview.id)}`,
          metadata: {
            interviewId: interview.id,
            reviewerId: normalizedReviewerId,
            workflowState,
            dueAt: reviewRequest?.dueAt || null,
            source: 'MANUAL',
          },
        });
      } catch (notificationError) {
        logger.warn(
          `Manual review reminder email sent but notification creation failed for interview ${interview.id} reviewer ${normalizedReviewerId}`,
          notificationError,
        );
      }

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_REVIEW_REMINDER_SENT',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            reviewerId: normalizedReviewerId,
            workflowState,
            source: 'MANUAL',
          },
        });
      }

      try {
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-review-reminder-sent', {
            interviewId: updatedInterview.id,
            reviewerId: normalizedReviewerId,
            workflowState,
            source: 'MANUAL',
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-review-reminder-sent realtime event:', eventError);
      }

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
      });
    } catch (error) {
      logger.error('Send interview review reminder error:', error);
      return next(error);
    }
  }

  static async updateInterviewStageOutcome(req, res, next) {
    try {
      const { id } = req.params;
      const {
        outcome,
        note,
        autoAdvance,
      } = req.body || {};
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (!isHiringInterview(interview)) {
        return res.status(409).json({
          error: 'Stage outcomes are only supported for hiring interviews.',
          code: 'INTERVIEW_STAGE_OUTCOME_NOT_SUPPORTED',
        });
      }

      if (String(interview?.status || '').toUpperCase() !== 'COMPLETED') {
        return res.status(409).json({
          error: 'Only completed interview stages can receive an outcome.',
          code: 'INTERVIEW_STAGE_NOT_COMPLETED',
        });
      }

      const application = await resolveLinkedApplicationForHiringInterview(interview);
      if (!application?.id || !application?.interviewPlan || !interview?.planStageId) {
        return res.status(409).json({
          error: 'A linked interview plan could not be resolved for this interview stage.',
          code: 'INTERVIEW_PLAN_CONTEXT_UNAVAILABLE',
        });
      }

      const normalizedPlan = normalizeInterviewPlanSnapshot(application.interviewPlan);
      const currentStage = getInterviewPlanStage(normalizedPlan, interview.planStageId);
      if (!currentStage) {
        return res.status(409).json({
          error: 'The interview stage could not be found in the linked interview plan.',
          code: 'INTERVIEW_STAGE_NOT_FOUND',
        });
      }

      const downstreamStagesExist = normalizedPlan.stages.some((stage) => (
        Number(stage?.sequence || 0) > Number(currentStage.sequence || 0)
        && (
          Boolean(stage?.interviewId)
          || String(stage?.status || '').toUpperCase() !== 'PENDING'
        )
      ));

      if (downstreamStagesExist) {
        return res.status(409).json({
          error: 'This stage outcome is locked because a later interview stage already exists.',
          code: 'INTERVIEW_STAGE_OUTCOME_LOCKED',
        });
      }

      const normalizedOutcome = String(outcome || '').trim().toUpperCase() || 'PENDING';
      const recordedAt = new Date().toISOString();
      const nextPlan = updateInterviewPlanStageOutcome(application.interviewPlan, interview.planStageId, {
        outcome: normalizedOutcome,
        note,
        recordedAt,
        recordedBy: req.user.id,
      });
      let updatedApplication = await jobApplicationStore.update(application.id, {
        interviewPlan: nextPlan,
      });
      let applicationStatusChange = null;
      if (normalizedOutcome === 'FAIL' && currentStage.failDispositionCode) {
        const rejectionResult = await autoRejectApplicationForFailedInterviewStage({
          application: {
            ...application,
            ...(updatedApplication && typeof updatedApplication === 'object' ? updatedApplication : {}),
          },
          interview,
          plan: nextPlan,
          stage: currentStage,
          actor: req.user,
          note,
        });
        if (rejectionResult.updated) {
          updatedApplication = rejectionResult.application;
          applicationStatusChange = {
            status: rejectionResult.status,
            dispositionCode: rejectionResult.disposition?.code || currentStage.failDispositionCode || null,
            dispositionCategory: rejectionResult.disposition?.category || null,
            dispositionReason: rejectionResult.disposition?.reason || null,
          };
        }
      }
      const shouldAutoAdvance = normalizedOutcome === 'PASS'
        && (
          autoAdvance === true
          || (autoAdvance !== false && currentStage.autoAdvanceOnPass === true)
        );
      let nextInterviewPayload = null;
      let autoAdvanceResult = null;
      let responsePlan = nextPlan;

      if (shouldAutoAdvance) {
        try {
          const stageResult = await createNextInterviewPlanStage({
            interview,
            recruiter: req.user,
            application: {
              ...application,
              ...(updatedApplication && typeof updatedApplication === 'object' ? updatedApplication : {}),
              interviewPlan: nextPlan,
            },
          });

          responsePlan = stageResult?.plan || nextPlan;
          if (stageResult?.interview) {
            const finalizedNextStage = await finalizeNextInterviewStageCreation({
              nextInterview: stageResult.interview,
              stageResult,
              actor: req.user,
              operation: 'AUTO_ADVANCE_STAGE_ON_PASS',
            });
            nextInterviewPayload = sanitizeInterviewForClient(finalizedNextStage.interview);
            autoAdvanceResult = {
              attempted: true,
              created: Boolean(stageResult.created),
              scheduled: Boolean(stageResult.scheduled),
              slotFound: Boolean(stageResult.slotFound),
              done: false,
              warning: stageResult.warning || null,
            };
          } else if (stageResult?.done) {
            autoAdvanceResult = {
              attempted: true,
              created: false,
              scheduled: false,
              done: true,
              warning: 'No further interview stages are planned for this application.',
            };
          } else if (stageResult?.blocked) {
            autoAdvanceResult = {
              attempted: true,
              created: false,
              scheduled: false,
              blocked: true,
              code: stageResult.code || 'INTERVIEW_STAGE_ADVANCE_BLOCKED',
              warning: stageResult.error || 'This interview stage is not ready to advance.',
            };
          } else {
            autoAdvanceResult = {
              attempted: true,
              created: false,
              scheduled: false,
              warning: null,
            };
          }
        } catch (autoAdvanceError) {
          logger.warn('Auto-advance interview stage creation failed after saving outcome:', autoAdvanceError);
          autoAdvanceResult = {
            attempted: true,
            created: false,
            scheduled: false,
            warning: 'Round decision was saved, but the next interview stage could not be created automatically.',
          };
        }
      }

      if (interview.organizationId) {
        await activityLogStore.record({
          organizationId: interview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_STAGE_OUTCOME_UPDATED',
          targetType: 'INTERVIEW',
          targetId: interview.id,
          metadata: {
            planStageId: interview.planStageId || null,
            planStageName: interview.planStageName || null,
            outcome: normalizedOutcome,
            note: typeof note === 'string' && note.trim() ? note.trim() : null,
            autoAdvanceRequested: Boolean(shouldAutoAdvance),
          },
        });
      }

      try {
        if (interview.organizationId) {
          await publishOrganizationRealtimeUpdate(interview.organizationId, 'interview-stage-outcome-updated', {
            interviewId: interview.id,
            planStageId: interview.planStageId || null,
            planStageName: interview.planStageName || null,
            outcome: normalizedOutcome,
            autoAdvanceRequested: Boolean(shouldAutoAdvance),
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-stage-outcome-updated realtime event:', eventError);
      }

      const hydrated = await attachSingleInterviewParticipants(interview);
      const interviewWithPlan = (await attachInterviewPlanContext([hydrated]))[0] || hydrated;
      return res.json({
        success: true,
        interview: sanitizeInterviewForClient(interviewWithPlan),
        plan: sanitizeInterviewPlanForClient(responsePlan),
        nextInterview: nextInterviewPayload,
        autoAdvance: autoAdvanceResult,
        applicationStatusChange,
      });
    } catch (error) {
      logger.error('Update interview stage outcome error:', error);
      return next(error);
    }
  }

  static async createNextInterviewStage(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (!isHiringInterview(interview)) {
        return res.status(409).json({
          error: 'Next interview stages are only supported for hiring interviews.',
          code: 'NEXT_STAGE_NOT_SUPPORTED',
        });
      }

      if (String(interview?.status || '').toUpperCase() !== 'COMPLETED') {
        return res.status(409).json({
          error: 'Complete the current interview before creating the next interview stage.',
          code: 'INTERVIEW_STAGE_NOT_COMPLETED',
        });
      }

      const stageResult = await createNextInterviewPlanStage({
        interview,
        recruiter: req.user,
      });

      if (stageResult?.blocked) {
        return res.status(409).json({
          error: stageResult.error || 'This interview stage is not ready to advance.',
          code: stageResult.code || 'INTERVIEW_STAGE_ADVANCE_BLOCKED',
          plan: sanitizeInterviewPlanForClient(stageResult?.plan),
          currentStage: stageResult.currentStage || null,
        });
      }

      if (stageResult?.done || !stageResult?.interview) {
        return res.status(409).json({
          error: 'No further interview stages are planned for this application.',
          code: 'NO_NEXT_INTERVIEW_STAGE',
          plan: sanitizeInterviewPlanForClient(stageResult?.plan),
        });
      }

      const nextInterview = stageResult.interview;
      const finalizedNextStage = await finalizeNextInterviewStageCreation({
        nextInterview,
        stageResult,
        actor: req.user,
        operation: 'CREATE_NEXT_STAGE_INTERVIEW',
      });
      return res.status(stageResult.created ? 201 : 200).json({
        success: true,
        interview: sanitizeInterviewForClient(finalizedNextStage.interview),
        created: Boolean(stageResult.created),
        scheduled: Boolean(stageResult.scheduled),
        slotFound: Boolean(stageResult.slotFound),
        currentStage: stageResult.currentStage || null,
        plan: sanitizeInterviewPlanForClient(stageResult.plan),
        warning: stageResult.warning || null,
        scheduleDecision: stageResult.scheduleDecision || null,
      });
    } catch (error) {
      logger.error('Create next interview stage error:', error);
      return next(error);
    }
  }

  static async requestInterviewReschedule(req, res, next) {
    try {
      const { id } = req.params;
      const {
        reason,
        preferredSlots,
        timezone,
      } = req.body || {};
      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (req.user?.accountType !== 'CANDIDATE' || interview?.candidateId !== req.user?.id) {
        return res.status(403).json({ error: 'Only the candidate can request a reschedule' });
      }

      if (!isHiringInterview(interview)) {
        return res.status(409).json({ error: 'Reschedule requests are only supported for hiring interviews' });
      }

      if (String(interview?.status || '').toUpperCase() !== 'SCHEDULED' || !interview?.scheduledFor) {
        return res.status(409).json({ error: 'Interview must be scheduled before requesting a reschedule' });
      }

      const scheduledAtMs = Date.parse(interview.scheduledFor);
      const nowMs = Date.now();
      if (Number.isFinite(scheduledAtMs) && scheduledAtMs - nowMs < RESCHEDULE_MIN_NOTICE_HOURS * 60 * 60 * 1000) {
        return res.status(409).json({
          error: `Reschedule requests must be submitted at least ${RESCHEDULE_MIN_NOTICE_HOURS} hours before the interview`,
        });
      }

      const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
      if (trimmedReason.length < RESCHEDULE_REASON_MIN_LENGTH) {
        return res.status(400).json({
          error: `Please provide at least ${RESCHEDULE_REASON_MIN_LENGTH} characters explaining why a reschedule is needed`,
        });
      }
      if (trimmedReason.length > RESCHEDULE_REASON_MAX_LENGTH) {
        return res.status(400).json({
          error: `Reschedule reason must be at most ${RESCHEDULE_REASON_MAX_LENGTH} characters`,
        });
      }

      if (
        Array.isArray(preferredSlots)
        && preferredSlots.some((slot) => slot && !isFutureDateTime(slot))
      ) {
        return res.status(400).json({
          error: 'Preferred reschedule slots must be in the future',
          code: 'PREFERRED_SLOT_IN_PAST',
        });
      }

      const normalizedRequests = normalizeRescheduleRequests(interview?.rescheduleRequests);
      const candidateRequests = normalizedRequests.filter((request) => request.requestedBy === req.user.id);
      const hasPendingRequest = normalizedRequests.some((request) => request.status === 'PENDING');
      if (hasPendingRequest) {
        return res.status(409).json({ error: 'A reschedule request is already pending review' });
      }

      if (candidateRequests.length >= MAX_RESCHEDULE_REQUESTS_PER_INTERVIEW) {
        return res.status(429).json({
          error: 'You have already used your reschedule request for this interview. Please contact the hiring team via email for further changes.',
          code: 'RESCHEDULE_LIMIT_REACHED',
        });
      }

      const latestRequest = candidateRequests[candidateRequests.length - 1] || null;
      if (latestRequest?.requestedAt) {
        const latestRequestMs = Date.parse(latestRequest.requestedAt);
        if (
          Number.isFinite(latestRequestMs)
          && nowMs - latestRequestMs < RESCHEDULE_REQUEST_COOLDOWN_HOURS * 60 * 60 * 1000
        ) {
          return res.status(429).json({
            error: `Please wait at least ${RESCHEDULE_REQUEST_COOLDOWN_HOURS} hours before submitting another reschedule request`,
          });
        }
      }

      const normalizedPreferredSlots = Array.isArray(preferredSlots)
        ? preferredSlots
          .map((slot) => normalizeIsoDate(slot))
          .filter(Boolean)
          .filter((slot) => Date.parse(slot) > nowMs)
          .slice(0, MAX_PREFERRED_RESCHEDULE_SLOTS)
        : [];
      const requestedAt = new Date().toISOString();
      const requestEntry = {
        id: crypto.randomUUID(),
        status: 'PENDING',
        reason: trimmedReason,
        preferredSlots: normalizedPreferredSlots,
        timezone: typeof timezone === 'string' && timezone.trim()
          ? timezone.trim()
          : (interview?.timezone || DEFAULT_TIMEZONE),
        requestedAt,
        requestedBy: req.user.id,
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        decisionSource: null,
      };

      const updatedInterview = await interviewStore.update(id, {
        rescheduleRequests: [...normalizedRequests, requestEntry],
        rescheduleRequestStatus: 'PENDING',
        latestRescheduleRequestId: requestEntry.id,
        latestRescheduleRequestAt: requestedAt,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.accountType || null,
          action: 'INTERVIEW_RESCHEDULE_REQUESTED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            requestId: requestEntry.id,
            preferredSlots: requestEntry.preferredSlots,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-reschedule-requested', {
          actor: req.user.id,
          requestId: requestEntry.id,
          requestedAt,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-reschedule-requested', {
            interviewId: updatedInterview.id,
            requestId: requestEntry.id,
            candidateId: updatedInterview.candidateId || null,
            jobId: updatedInterview.jobId || null,
            requestedAt,
          });
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'interview-reschedule-requested', {
            interviewId: updatedInterview.id,
            requestId: requestEntry.id,
            organizationId: updatedInterview.organizationId || null,
            requestedAt,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-reschedule-requested realtime event:', eventError);
      }

      if (updatedInterview.companyId) {
        notificationStore.create({
          userId: updatedInterview.companyId,
          type: 'interview_reschedule_request',
          title: 'Candidate requested reschedule',
          message: 'A candidate requested to reschedule their interview.',
          link: '/company-interviews',
        }).catch(() => {});
      }

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
        request: requestEntry,
      });
    } catch (error) {
      logger.error('Request interview reschedule error:', error);
      return next(error);
    }
  }

  static async rejectInterviewRescheduleRequest(req, res, next) {
    try {
      const { id, requestId } = req.params;
      const reviewNote = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const normalizedRequests = normalizeRescheduleRequests(interview?.rescheduleRequests);
      const requestIndex = normalizedRequests.findIndex((request) => request.id === requestId);
      if (requestIndex < 0) {
        return res.status(404).json({ error: 'Reschedule request not found' });
      }

      const targetRequest = normalizedRequests[requestIndex];
      if (targetRequest.status !== 'PENDING') {
        return res.status(409).json({ error: 'Only pending requests can be rejected' });
      }

      const reviewedAt = new Date().toISOString();
      normalizedRequests[requestIndex] = {
        ...targetRequest,
        status: 'REJECTED',
        reviewedAt,
        reviewedBy: req.user.id,
        reviewNote: reviewNote || null,
        decisionSource: 'COMPANY_REJECTED',
      };

      const updatedInterview = await interviewStore.update(id, {
        rescheduleRequests: normalizedRequests,
        rescheduleRequestStatus: 'RESOLVED',
        lastResolvedRescheduleRequestId: targetRequest.id,
        lastResolvedRescheduleRequestAt: reviewedAt,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_RESCHEDULE_REQUEST_REJECTED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            requestId: targetRequest.id,
            reviewNote: reviewNote || null,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-reschedule-request-rejected', {
          actor: req.user.id,
          requestId: targetRequest.id,
          reviewedAt,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(
            updatedInterview.organizationId,
            'interview-reschedule-request-rejected',
            {
              interviewId: updatedInterview.id,
              requestId: targetRequest.id,
              candidateId: updatedInterview.candidateId || null,
              reviewedAt,
            },
          );
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(
            updatedInterview.candidateId,
            'interview-reschedule-request-rejected',
            {
              interviewId: updatedInterview.id,
              requestId: targetRequest.id,
              organizationId: updatedInterview.organizationId || null,
              reviewedAt,
            },
          );
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-reschedule-request-rejected realtime event:', eventError);
      }

      if (updatedInterview.candidateId) {
        notificationStore.create({
          userId: updatedInterview.candidateId,
          type: 'interview_reschedule_request_rejected',
          title: 'Reschedule request update',
          message: 'Your reschedule request was reviewed by the hiring team.',
          link: '/candidate-dashboard',
        }).catch(() => {});
      }

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
      });
    } catch (error) {
      logger.error('Reject interview reschedule request error:', error);
      return next(error);
    }
  }

  static async contactCompanyAboutInterview(req, res, next) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const trimmedMessage = (message || '').trim();
      if (!trimmedMessage || trimmedMessage.length < 10) {
        return res.status(400).json({ error: 'Message must be at least 10 characters.' });
      }
      if (trimmedMessage.length > 1000) {
        return res.status(400).json({ error: 'Message must be at most 1000 characters.' });
      }

      const interview = await interviewStore.getById(id);
      if (!interview) {
        return res.status(404).json({ error: 'Interview not found' });
      }
      if (req.user?.accountType !== 'CANDIDATE' || interview.candidateId !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to contact company for this interview' });
      }
      if (!isHiringInterview(interview)) {
        return res.status(400).json({ error: 'Contact messages are only supported for hiring interviews' });
      }

      const sentAt = new Date().toISOString();
      const candidateName = req.user.fullName || req.user.email || 'A candidate';

      await interviewStore.update(id, {
        lastCandidateContact: {
          message: trimmedMessage,
          candidateName,
          candidateId: req.user.id,
          sentAt,
        },
      });

      if (interview.companyId) {
        await notificationStore.create({
          userId: interview.companyId,
          type: 'interview_candidate_message',
          title: 'Message from candidate',
          message: `${candidateName}: ${trimmedMessage.length > 120 ? `${trimmedMessage.slice(0, 120)}...` : trimmedMessage}`,
          link: `/company-interviews?interviewId=${interview.id}`,
          metadata: {
            interviewId: interview.id,
            candidateId: req.user.id,
            candidateName,
            fullMessage: trimmedMessage,
            sentAt,
          },
        });
      }

      if (interview.organizationId) {
        await activityLogStore.record({
          organizationId: interview.organizationId,
          actorId: req.user.id,
          actorRole: 'CANDIDATE',
          action: 'INTERVIEW_CANDIDATE_MESSAGE',
          targetType: 'INTERVIEW',
          targetId: interview.id,
          metadata: {
            message: trimmedMessage,
            sentAt,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-candidate-message', {
          actor: req.user.id,
          sentAt,
        });
        if (interview.organizationId) {
          await publishOrganizationRealtimeUpdate(interview.organizationId, 'interview-candidate-message', {
            interviewId: interview.id,
            candidateId: req.user.id,
            sentAt,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-candidate-message realtime event:', eventError);
      }

      return res.json({ success: true, sentAt });
    } catch (error) {
      logger.error('Contact company about interview error:', error);
      return next(error);
    }
  }

  static async cancelInterview(req, res, next) {
    try {
      const { id } = req.params;
      const reason = req.body?.reason ? String(req.body.reason).trim() : null;
      const interview = await interviewStore.getById(id);
      const access = canManageSchedule(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (isTerminalInterviewStatus(interview.status)) {
        return res.status(409).json({ error: 'Interview is already completed or cancelled' });
      }

      const cancelledAt = new Date().toISOString();
      const updatedInterview = await interviewStore.update(id, {
        status: 'CANCELLED',
        scheduleStatus: 'CANCELLED',
        cancelledAt,
        cancelledBy: req.user.id,
        cancellationReason: reason || null,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_CANCELLED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            reason: reason || null,
            scheduledFor: updatedInterview.scheduledFor || null,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-cancelled', {
          actor: req.user.id,
          status: 'CANCELLED',
          cancelledAt,
          reason: reason || null,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-cancelled', {
            interviewId: updatedInterview.id,
            status: 'CANCELLED',
            cancelledAt,
            candidateId: updatedInterview.candidateId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'interview-cancelled', {
            interviewId: updatedInterview.id,
            status: 'CANCELLED',
            cancelledAt,
            organizationId: updatedInterview.organizationId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-cancelled realtime event:', eventError);
      }

      await queueHiringInterviewEmail({
        type: 'INTERVIEW_CANCELLED',
        interview: updatedInterview,
        payload: { operation: 'CANCEL_INTERVIEW' },
        send: async ({ candidate, job, organization }) =>
          emailNotifications.sendInterviewCancelled(
            updatedInterview,
            candidate,
            job,
            organization,
            reason || '',
          ),
        logLabel: 'Interview cancelled',
      });

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.json({ success: true, interview: sanitizeInterviewForClient(hydrated) });
    } catch (error) {
      logger.error('Cancel interview error:', error);
      return next(error);
    }
  }

  static async uploadRecording(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getById(id);
        const access = canUploadRecording(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req, {
        allowCompletedRecordingUpload: true,
      });
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      if (!req.file?.path) {
        return res.status(400).json({ error: 'Recording file is required' });
      }

      const publicPath = toUploadsPublicPath(req.file.path);
      if (!publicPath) {
        return res.status(400).json({ error: 'Invalid recording storage path' });
      }

      const recordingMetadata = {
        path: publicPath,
        size: req.file.size || null,
        mimeType: req.file.mimetype || null,
        createdAt: new Date().toISOString(),
        createdBy: req.user.id,
        originalName: req.file.originalname || null,
      };

      const updatedInterview = await interviewStore.update(id, {
        recordingUrl: publicPath,
        recording: recordingMetadata,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_RECORDING_UPLOADED',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            path: publicPath,
            size: recordingMetadata.size,
            mimeType: recordingMetadata.mimeType,
          },
        });
      }

      const hydrated = await attachSingleInterviewParticipants(updatedInterview);
      return res.status(201).json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
        recordingUrl: publicPath,
        recording: recordingMetadata,
      });
    } catch (error) {
      logger.error('Upload recording error:', error);
      return next(error);
    }
  }

  static async getRecordingUrl(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getById(id);
      const access = canViewRecording(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const recordingPath = interview?.recordingUrl || interview?.recording?.path || null;
      if (!recordingPath) {
        return res.status(404).json({
          error: 'Recording not available for this interview',
          code: 'RECORDING_NOT_FOUND',
        });
      }

      const relativePath = recordingPath.replace(/^\/?uploads\//, '');
      const absolutePath = path.resolve(uploadsPaths.root, relativePath);
      const uploadsRoot = path.resolve(uploadsPaths.root);
      if (!absolutePath.startsWith(`${uploadsRoot}${path.sep}`)) {
        return res.status(400).json({ error: 'Invalid recording path' });
      }

      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({
          error: 'Recording file not found on storage',
          code: 'RECORDING_FILE_MISSING',
        });
      }

      const signedRelativeUrl = createSignedDownloadPath({
        publicPath: recordingPath,
        expiresInSeconds: 600,
      });
      const resolvedUrl = signedRelativeUrl
        ? buildAbsoluteApiUrl(req, signedRelativeUrl)
        : buildAbsoluteApiUrl(req, recordingPath);

      return res.json({
        success: true,
        recordingUrl: resolvedUrl,
        recordingPath,
      });
    } catch (error) {
      logger.error('Get recording URL error:', error);
      return next(error);
    }
  }

  static async startInterview(req, res, next) {
    try {
      const { id } = req.params;
      let interview = await interviewStore.getWithQuestions(id);
      let llmUnavailable = Boolean(interview?.llmUnavailable);
      let questionPlanSummary = null;
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req, { requireActiveWindow: true });
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      if (interview.status !== 'SCHEDULED' && interview.status !== 'PAUSED') {
        return res.status(400).json({ error: 'Interview cannot be started in current state' });
      }

      if (!interview.recordingConsentGivenAt) {
        return res.status(409).json({
          error: 'Recording consent is required before starting the interview',
          code: 'RECORDING_CONSENT_REQUIRED',
        });
      }

      if (!interview.questions || interview.questions.length === 0) {
        const normalizedPrepNotes = typeof interview?.config?.prepNotes === 'string'
          ? interview.config.prepNotes.trim()
          : '';
        const config = {
          jobRole: interview.jobRole,
          experienceLevel: interview.experienceLevel,
          industry: interview.industry,
          interviewTypes: interview.interviewTypes,
          skillFocus: interview.skillFocus || [], // Include skillFocus
          totalQuestions: Math.floor((interview.duration || 30) / 3),
          // Include personality and difficulty from config if available
          personality: interview.config?.personality || null,
          difficulty: interview.config?.advancedSettings?.difficulty || 'medium',
          interviewerName: interview.config?.interviewerName || null,
          llmOptions: resolveInterviewLlmOptions(interview.config),
        };

        let generatedQuestions = [];
        const templateOverride = await resolveOrganizationTemplateOverride(interview);

        const normalizedInterviewMode = String(interview?.mode || '').toUpperCase();
        const structuredPlan = normalizedInterviewMode === 'PRACTICE'
          ? await buildStructuredInterviewQuestionPlanAsync({
            interview,
            totalQuestions: config.totalQuestions,
            templateOverrides: templateOverride ? [templateOverride] : [],
          })
          : buildStructuredInterviewQuestionPlan({
            interview,
            totalQuestions: config.totalQuestions,
            templateOverrides: templateOverride ? [templateOverride] : [],
          });

        if (structuredPlan.enabled && structuredPlan.questions.length > 0) {
          generatedQuestions = [...structuredPlan.questions];
          questionPlanSummary = {
            strategy: structuredPlan.strategy?.mode || 'HYBRID_TEMPLATE',
            enabled: true,
            templateId: structuredPlan.template?.id || null,
            templateName: structuredPlan.template?.name || null,
            templateSource: structuredPlan.template?.source || null,
            coreQuestionCount: structuredPlan.coreQuestionCount || 0,
            randomizedQuestionCount: structuredPlan.randomizedQuestionCount || 0,
            llmFillCount: structuredPlan.llmFillCount || 0,
            questionLibraryVersion: structuredPlan.metadata?.libraryVersion || null,
            catalogVersion: structuredPlan.metadata?.catalogVersion || structuredPlan.metadata?.libraryVersion || null,
            catalogSource: structuredPlan.metadata?.catalogSource || null,
            approvedPoolSize: structuredPlan.metadata?.approvedPoolSize || null,
            matchedPoolSize: structuredPlan.metadata?.matchedPoolSize || null,
            scorecardBlueprint: structuredPlan.scorecardBlueprint || null,
            generatedAt: new Date().toISOString(),
          };
        }

        const llmFillNeeded = Math.max(config.totalQuestions - generatedQuestions.length, 0);
        if (llmFillNeeded > 0 && (!structuredPlan.enabled || structuredPlan.strategy?.allowLlmFill)) {
          try {
            const llmGenerated = await LLMService.generateInterviewQuestions({
              ...config,
              totalQuestions: llmFillNeeded,
            });

            const llmQuestions = (Array.isArray(llmGenerated) ? llmGenerated : []).map((question, index) => ({
              ...question,
              id: question?.id || `llm_q_${generatedQuestions.length + index + 1}`,
              sequence: generatedQuestions.length + index + 1,
              questionSource: structuredPlan.enabled ? 'LLM_FILL' : 'LLM',
              questionTemplateId: structuredPlan.template?.id || null,
              approvedQuestion: false,
              isCoreQuestion: false,
            }));

            generatedQuestions = [...generatedQuestions, ...llmQuestions];
            if (questionPlanSummary) {
              questionPlanSummary.llmFillCount = llmQuestions.length;
            }
          } catch (generationError) {
            if (!isLikelyOllamaUnavailableError(generationError)) {
              throw generationError;
            }
            if (!generatedQuestions.length) {
              llmUnavailable = true;
              generatedQuestions = buildFallbackQuestions(interview);
              await interviewStore.update(id, {
                llmUnavailable: true,
                llmUnavailableAt: new Date().toISOString(),
                pendingEvaluation: true,
                llmFallbackReason: String(generationError?.message || 'OLLAMA_UNAVAILABLE').slice(0, 500),
              });
              logger.warn('Ollama unavailable at interview start; fallback question pack applied.');
            } else {
              if (questionPlanSummary) {
                questionPlanSummary.llmFillCount = 0;
              }
              logger.warn('Ollama unavailable for LLM fill; continuing with structured question set only.');
            }
          }
        }

        if (!generatedQuestions.length && !structuredPlan.enabled) {
          try {
            generatedQuestions = await LLMService.generateInterviewQuestions(config);
          } catch (generationError) {
            if (!isLikelyOllamaUnavailableError(generationError)) {
              throw generationError;
            }
            llmUnavailable = true;
            generatedQuestions = buildFallbackQuestions(interview);
            await interviewStore.update(id, {
              llmUnavailable: true,
              llmUnavailableAt: new Date().toISOString(),
              pendingEvaluation: true,
              llmFallbackReason: String(generationError?.message || 'OLLAMA_UNAVAILABLE').slice(0, 500),
            });
            logger.warn('Ollama unavailable at interview start; fallback question pack applied.');
          }
        }

        if (!generatedQuestions.length) {
          generatedQuestions = buildFallbackQuestions(interview);
          questionPlanSummary = questionPlanSummary || {
            strategy: 'FALLBACK',
            enabled: false,
            templateId: null,
            templateName: null,
            templateSource: null,
            coreQuestionCount: 0,
            randomizedQuestionCount: 0,
            llmFillCount: 0,
            questionLibraryVersion: null,
            catalogVersion: null,
            catalogSource: null,
            approvedPoolSize: null,
            matchedPoolSize: null,
            scorecardBlueprint: null,
            generatedAt: new Date().toISOString(),
          };
        }

        await interviewStore.addQuestions(id, generatedQuestions);
        interview = await interviewStore.getWithQuestions(id);

        if (
          normalizedPrepNotes
          && Array.isArray(interview?.questions)
          && interview.questions.length > 0
          && !interview.questions[0]?.prepNotes
        ) {
          await interviewStore.updateQuestion(id, interview.questions[0].id, {
            prepNotes: normalizedPrepNotes,
          });
          interview.questions[0] = {
            ...interview.questions[0],
            prepNotes: normalizedPrepNotes,
          };
        }
      }

      const updatedInterview = await interviewStore.update(id, {
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
        ...(questionPlanSummary ? { questionPlan: questionPlanSummary } : {}),
        ...(llmUnavailable ? { llmUnavailable: true, pendingEvaluation: true } : {}),
      });

      try {
        await recordRealtimeEvent(id, 'interview-started', {
          actor: req.user.id,
          status: 'IN_PROGRESS',
          startedAt: updatedInterview.startedAt,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-started', {
            interviewId: updatedInterview.id,
            status: 'IN_PROGRESS',
            startedAt: updatedInterview.startedAt,
            candidateId: updatedInterview.candidateId || null,
            companyId: updatedInterview.companyId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-started realtime event:', eventError);
      }

      const responseInterview = await attachSingleInterviewParticipants({
        ...updatedInterview,
        questions: interview.questions,
      });

      res.json({
        success: true,
        interview: sanitizeInterviewForClient(responseInterview),
        llmUnavailable: Boolean(responseInterview?.llmUnavailable),
        pendingEvaluation: Boolean(responseInterview?.pendingEvaluation),
      });
    } catch (error) {
      logger.error('Start interview error:', error);
      next(error);
    }
  }

  static async endInterview(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req);
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      if (interview.status !== 'IN_PROGRESS') {
        return res.status(409).json({
          error: 'Interview cannot be ended because it is not in progress',
          code: 'INTERVIEW_NOT_IN_PROGRESS',
        });
      }

      const answeredQuestions = (interview.questions || []).filter((q) => q.answer);
      const evaluationResult = await evaluateInterviewWithFallback({
        interview,
        questions: answeredQuestions,
        llmOptions: resolveInterviewLlmOptions(interview.config),
        operation: 'end',
      });
      const { evaluation, pendingEvaluation, llmUnavailable, metadata, reasonCode } = evaluationResult;

      const completionTimestamp = new Date().toISOString();
      const completedReviewRequests = syncReviewRequests({
        existingReviewRequests: interview?.reviewRequests,
        reviewerAssignments: interview?.reviewerAssignments,
        assignedBy: interview?.scheduledBy || interview?.companyId || null,
        interview: {
          ...interview,
          status: 'COMPLETED',
          completedAt: completionTimestamp,
          duration: interview?.duration,
        },
        nowValue: completionTimestamp,
      });
      const updatedInterview = await interviewStore.update(id, {
        status: 'COMPLETED',
        endedAt: completionTimestamp,
        completedAt: completionTimestamp,
        reviewRequests: completedReviewRequests,
        evaluation,
        overallScore: pendingEvaluation ? null : evaluation?.overallScore ?? null,
        readinessLevel: pendingEvaluation ? null : evaluation?.readinessLevel ?? null,
        llmUnavailable,
        pendingEvaluation,
        llmUnavailableAt: llmUnavailable ? new Date().toISOString() : interview?.llmUnavailableAt || null,
        llmFallbackReason: pendingEvaluation ? reasonCode : null,
        evaluationMetadata: metadata,
      });

      const completedPlanStage = await completeLinkedInterviewPlanStage({
        interview: updatedInterview,
        completedAt: completionTimestamp,
      }).catch((planError) => {
        logger.warn('Failed to update linked interview plan after interview completion:', planError);
        return { application: null, updated: false, plan: null };
      });
      let nextInterviewPayload = null;
      let completionAutoAdvance = null;
      if (completedPlanStage?.updated && completedPlanStage.application?.organizationId) {
        await publishOrganizationRealtimeUpdate(
          completedPlanStage.application.organizationId,
          'application-interview-stage-completed',
          {
            applicationId: completedPlanStage.application.id,
            interviewId: updatedInterview.id,
            planStageId: updatedInterview.planStageId || null,
            planStageName: updatedInterview.planStageName || null,
          },
        );
        await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'application-interview-stage-completed', {
          applicationId: completedPlanStage.application.id,
          interviewId: updatedInterview.id,
          organizationId: completedPlanStage.application.organizationId,
          jobId: updatedInterview.jobId || null,
          planStageId: updatedInterview.planStageId || null,
          planStageName: updatedInterview.planStageName || null,
        });
      }

      const completedPlan = completedPlanStage?.plan
        ? normalizeInterviewPlanSnapshot(completedPlanStage.plan)
        : null;
      const completedStage = completedPlan
        ? getInterviewPlanStage(completedPlan, updatedInterview.planStageId)
        : null;

      if (
        isHiringInterview(updatedInterview)
        && completedStage?.advanceRule === 'COMPLETE_TO_CONTINUE'
        && completedStage?.autoAdvanceOnComplete === true
        && completedPlanStage?.application?.id
      ) {
        try {
          const stageResult = await createNextInterviewPlanStage({
            interview: updatedInterview,
            recruiter: req.user,
            application: {
              ...completedPlanStage.application,
              interviewPlan: completedPlanStage.plan,
            },
          });

          if (stageResult?.interview) {
            const finalizedNextStage = await finalizeNextInterviewStageCreation({
              nextInterview: stageResult.interview,
              stageResult,
              actor: req.user,
              operation: 'AUTO_ADVANCE_STAGE_ON_COMPLETE',
            });
            nextInterviewPayload = sanitizeInterviewForClient(finalizedNextStage.interview);
            completionAutoAdvance = {
              attempted: true,
              created: Boolean(stageResult.created),
              scheduled: Boolean(stageResult.scheduled),
              slotFound: Boolean(stageResult.slotFound),
              done: false,
              warning: stageResult.warning || null,
            };
          } else if (stageResult?.done) {
            completionAutoAdvance = {
              attempted: true,
              created: false,
              scheduled: false,
              done: true,
              warning: 'No further interview stages are planned for this application.',
            };
          } else if (stageResult?.blocked) {
            completionAutoAdvance = {
              attempted: true,
              created: false,
              scheduled: false,
              blocked: true,
              code: stageResult.code || 'INTERVIEW_STAGE_ADVANCE_BLOCKED',
              warning: stageResult.error || 'This interview stage is not ready to advance.',
            };
          }
        } catch (autoAdvanceError) {
          logger.warn('Automatic stage progression on completion failed:', autoAdvanceError);
          completionAutoAdvance = {
            attempted: true,
            created: false,
            scheduled: false,
            warning: 'Interview was completed, but the next stage could not be created automatically.',
          };
        }
      }

      // GAP FIX: Auto-update application status when interview completes
      if (updatedInterview.mode === 'HIRING' && updatedInterview.invitationId) {
        try {
          const invitation = await invitationStore.getById(updatedInterview.invitationId);
          if (invitation && invitation.acceptedApplicationId) {
            // Update application to mark interview as completed
            await jobApplicationStore.update(invitation.acceptedApplicationId, {
              interviewCompletedAt: updatedInterview.endedAt,
              // Keep status as INTERVIEWING until review/decision
            });
            logger.info(`Application ${invitation.acceptedApplicationId} updated with interview completion`);
          }
        } catch (applicationUpdateError) {
          logger.warn('Failed to update application after interview completion:', applicationUpdateError);
          // Non-fatal - interview still completed successfully
        }
      }

      // GAP FEATURE: Update practice streak for PRACTICE mode interviews
      if (updatedInterview.mode === 'PRACTICE' && updatedInterview.candidateId) {
        try {
          const { updatePracticeStreak } = await import('../services/firebaseData.service.js');
          await updatePracticeStreak(updatedInterview.candidateId, updatedInterview.endedAt);
        } catch (streakError) {
          logger.warn('Failed to update practice streak:', streakError);
          // Non-fatal - interview still completed successfully
        }
      }

      // Award referral bonus exactly once when a referred candidate completes first interview.
      if (updatedInterview.candidateId) {
        try {
          await ReferralController.onFirstInterviewInternal({
            userId: updatedInterview.candidateId,
          });
        } catch (referralError) {
          // Non-fatal: interview completion should not fail due to referral bookkeeping.
          logger.warn('Failed to process referral first-interview bonus:', referralError);
        }
      }

      try {
        await recordRealtimeEvent(id, 'interview-ended', {
          actor: req.user.id,
          status: 'COMPLETED',
          endedAt: updatedInterview.endedAt,
          overallScore: updatedInterview.overallScore ?? null,
          readinessLevel: updatedInterview.readinessLevel ?? null,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-ended', {
            interviewId: updatedInterview.id,
            status: 'COMPLETED',
            endedAt: updatedInterview.endedAt,
            overallScore: updatedInterview.overallScore ?? null,
            readinessLevel: updatedInterview.readinessLevel ?? null,
            candidateId: updatedInterview.candidateId || null,
            companyId: updatedInterview.companyId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
        if (updatedInterview.candidateId) {
          await publishCandidateRealtimeUpdate(updatedInterview.candidateId, 'interview-ended', {
            interviewId: updatedInterview.id,
            status: 'COMPLETED',
            endedAt: updatedInterview.endedAt,
            overallScore: updatedInterview.overallScore ?? null,
            readinessLevel: updatedInterview.readinessLevel ?? null,
            organizationId: updatedInterview.organizationId || null,
            jobId: updatedInterview.jobId || null,
          });
        }

        await publishAdminRealtimeUpdate('interview-completed', {
          interviewId: updatedInterview.id,
          organizationId: updatedInterview.organizationId || null,
          status: 'COMPLETED',
          endedAt: updatedInterview.endedAt,
          overallScore: updatedInterview.overallScore ?? null,
          readinessLevel: updatedInterview.readinessLevel ?? null,
        });
      } catch (eventError) {
        logger.warn('Failed to publish interview-ended realtime event:', eventError);
      }

      // Emit in-app notification for interview completion
      if (updatedInterview.candidateId) {
        notificationStore.create({
          userId: updatedInterview.candidateId,
          type: pendingEvaluation ? 'interview_completed' : 'evaluation_ready',
          title: pendingEvaluation ? 'Interview Completed' : 'Your Results Are Ready',
          message: pendingEvaluation
            ? `Your ${updatedInterview.jobRole || 'interview'} session has been saved. Evaluation is pending.`
            : `Your ${updatedInterview.jobRole || 'interview'} session has been evaluated. Score: ${updatedInterview.overallScore != null ? Math.round(updatedInterview.overallScore) + '%' : 'N/A'}`,
          link: `/interview-results/${updatedInterview.id}`,
        }).catch(() => {});
      }

      await queueHiringInterviewEmail({
        type: 'INTERVIEW_COMPLETED_UNDER_REVIEW',
        interview: updatedInterview,
        payload: { operation: 'END_INTERVIEW' },
        send: async ({ candidate, job, organization }) =>
          emailNotifications.sendInterviewCompletedUnderReview(
            updatedInterview,
            candidate,
            job,
            organization,
          ),
        logLabel: 'Interview completed under review',
      });

      const hydrated = await attachSingleInterviewParticipants({
        ...updatedInterview,
        questions: interview.questions,
      });
      const interviewWithPlan = (await attachInterviewPlanContext([hydrated]))[0] || hydrated;

      res.json({
        success: true,
        interview: sanitizeInterviewForClient(interviewWithPlan),
        nextInterview: nextInterviewPayload,
        autoAdvance: completionAutoAdvance,
        pendingEvaluation: Boolean(interviewWithPlan?.pendingEvaluation),
        llmUnavailable: Boolean(interviewWithPlan?.llmUnavailable),
        message: interviewWithPlan?.pendingEvaluation
          ? (evaluationResult.message || 'AI scoring unavailable; session saved, scoring pending.')
          : undefined,
      });
    } catch (error) {
      logger.error('End interview error:', error);
      next(error);
    }
  }

  static async runEvaluation(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = canRunEvaluation(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const normalizedStatus = String(interview?.status || '').toUpperCase();
      if (normalizedStatus !== 'COMPLETED') {
        return res.status(409).json({
          error: 'Interview must be completed before running evaluation',
          code: 'INTERVIEW_NOT_COMPLETED',
        });
      }

      const existingEvaluation = interview?.evaluation && typeof interview.evaluation === 'object'
        ? interview.evaluation
        : null;
      const hasCompletedEvaluation = Boolean(
        existingEvaluation
          && !interview?.pendingEvaluation
          && interview?.overallScore != null
          && interview?.readinessLevel,
      );

      if (hasCompletedEvaluation) {
        const hydratedExisting = await attachSingleInterviewParticipants(interview);
        return res.json({
          success: true,
          interview: sanitizeInterviewForClient(hydratedExisting),
          reusedExistingEvaluation: true,
          pendingEvaluation: false,
          llmUnavailable: Boolean(hydratedExisting?.llmUnavailable),
        });
      }

      const answeredQuestions = (interview.questions || []).filter((q) => q.answer);
      const evaluationResult = await evaluateInterviewWithFallback({
        interview,
        questions: answeredQuestions,
        llmOptions: resolveInterviewLlmOptions(interview.config),
        operation: 'manual-run',
      });
      const { evaluation, pendingEvaluation, llmUnavailable, metadata, reasonCode } = evaluationResult;

      const updatedInterview = await interviewStore.update(id, {
        evaluation,
        overallScore: pendingEvaluation ? null : evaluation?.overallScore ?? null,
        readinessLevel: pendingEvaluation ? null : evaluation?.readinessLevel ?? null,
        llmUnavailable,
        pendingEvaluation,
        llmUnavailableAt: llmUnavailable ? new Date().toISOString() : interview?.llmUnavailableAt || null,
        llmFallbackReason: pendingEvaluation ? reasonCode : null,
        evaluationMetadata: metadata,
      });

      if (updatedInterview.organizationId) {
        await activityLogStore.record({
          organizationId: updatedInterview.organizationId,
          actorId: req.user.id,
          actorRole: req.user.organizationContext?.membership?.role || req.user.accountType || null,
          action: 'INTERVIEW_EVALUATION_RUN',
          targetType: 'INTERVIEW',
          targetId: updatedInterview.id,
          metadata: {
            pendingEvaluation,
            llmUnavailable,
            reasonCode: reasonCode || null,
            overallScore: updatedInterview.overallScore ?? null,
          },
        });
      }

      try {
        await recordRealtimeEvent(id, 'interview-evaluated', {
          actor: req.user.id,
          pendingEvaluation,
          llmUnavailable,
          overallScore: updatedInterview.overallScore ?? null,
          readinessLevel: updatedInterview.readinessLevel ?? null,
        });
        if (updatedInterview.organizationId) {
          await publishOrganizationRealtimeUpdate(updatedInterview.organizationId, 'interview-evaluated', {
            interviewId: updatedInterview.id,
            pendingEvaluation,
            llmUnavailable,
            overallScore: updatedInterview.overallScore ?? null,
            readinessLevel: updatedInterview.readinessLevel ?? null,
            candidateId: updatedInterview.candidateId || null,
            jobId: updatedInterview.jobId || null,
          });
        }
      } catch (eventError) {
        logger.warn('Failed to publish interview-evaluated realtime event:', eventError);
      }

      const hydrated = await attachSingleInterviewParticipants({
        ...updatedInterview,
        questions: interview.questions,
      });

      return res.json({
        success: true,
        interview: sanitizeInterviewForClient(hydrated),
        reusedExistingEvaluation: false,
        pendingEvaluation: Boolean(hydrated?.pendingEvaluation),
        llmUnavailable: Boolean(hydrated?.llmUnavailable),
        message: hydrated?.pendingEvaluation
          ? (evaluationResult.message || 'Evaluation pending. You can run evaluation later.')
          : undefined,
      });
    } catch (error) {
      logger.error('Run evaluation error:', error);
      return next(error);
    }
  }

  static async getMyInterviews(req, res, next) {
    try {
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationId = req.user.organizationContext?.organization?.id || null;
      const reviewerOnly = accountType === 'COMPANY' && isReviewerRole(req.user);
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;

      const candidateInterviews = await interviewStore.listByCandidate(userId, { limit: listLimit });
      let companyInterviews = accountType === 'COMPANY'
        ? (organizationId
          ? await interviewStore.listByOrganization(
            organizationId,
            reviewerOnly ? {} : { limit: listLimit },
          )
          : await interviewStore.listByCompany(userId, { limit: listLimit }))
        : [];

      if (reviewerOnly) {
        companyInterviews = filterInterviewsForReviewer(companyInterviews, userId).slice(0, listLimit);
      }

      const combinedMap = new Map();
      [...candidateInterviews, ...companyInterviews].forEach((interview) => {
        if (interview) combinedMap.set(interview.id, interview);
      });

      const interviewsArray = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );

      const hydrated = (await hydrateInterviewParticipants(interviewsArray)).map((interview) => {
        const schedulingMeta = enrichInterviewSchedulingMeta(interview);
        return {
          ...schedulingMeta,
          ...enrichInterviewReviewRequests(schedulingMeta),
        };
      });
      const interviewsWithPlans = await attachInterviewPlanContext(hydrated);

      res.json({ success: true, interviews: sanitizeInterviewCollectionForClient(interviewsWithPlans) });
    } catch (error) {
      logger.error('Get my interviews error:', error);
      next(error);
    }
  }

  static async getCompanyInterviews(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id || null;
      const companyId = req.user.id;
      const reviewerOnly = isReviewerRole(req.user);
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;
      let interviews = organizationId
        ? await interviewStore.listByOrganization(
          organizationId,
          reviewerOnly ? {} : { limit: listLimit },
        )
        : await interviewStore.listByCompany(companyId, { limit: listLimit });
      if (reviewerOnly) {
        interviews = filterInterviewsForReviewer(interviews, req.user.id).slice(0, listLimit);
      }
      const hydrated = (await hydrateInterviewParticipants(interviews)).map((interview) => {
        const schedulingMeta = enrichInterviewSchedulingMeta(interview);
        return {
          ...schedulingMeta,
          ...enrichInterviewReviewRequests(schedulingMeta),
        };
      });
      const interviewsWithReviewState = await attachReviewerQueueState(hydrated, req.user);
      const interviewsWithPlans = await attachInterviewPlanContext(interviewsWithReviewState);

      res.json({ success: true, interviews: sanitizeInterviewCollectionForClient(interviewsWithPlans) });
    } catch (error) {
      logger.error('Get company interviews error:', error);
      next(error);
    }
  }

  static async getEvaluation(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const evaluation = {
        id: interview.id,
        evaluation: interview.evaluation,
        overallScore: interview.overallScore,
        readinessLevel: interview.readinessLevel,
        evaluationMetadata: interview.evaluationMetadata || null,
        pendingEvaluation: Boolean(interview.pendingEvaluation),
        llmUnavailable: Boolean(interview.llmUnavailable),
        questions: (interview.questions || []).map((question) => ({
          id: question.id,
          question: question.question,
          answer: question.answer,
          score: question.score,
          feedback: question.feedback,
        })),
      };

      res.json({ success: true, evaluation });
    } catch (error) {
      logger.error('Get evaluation error:', error);
      next(error);
    }
  }

  static async getScoreLeaderboard(req, res, next) {
    try {
      const rawInterviews = await interviewStore.listCompletedScoredForLeaderboard();
      const candidateStats = new Map();

      rawInterviews.forEach((interview) => {
        const candidateId = interview?.candidateId;
        const score = Number(interview?.overallScore);
        if (!candidateId || !Number.isFinite(score)) return;

        const current = candidateStats.get(candidateId) || {
          userId: candidateId,
          scoredInterviews: 0,
          scoreSum: 0,
          bestScore: null,
          latestCompletedAt: null,
        };

        current.scoredInterviews += 1;
        current.scoreSum += score;
        current.bestScore = current.bestScore == null ? score : Math.max(current.bestScore, score);

        const completedAt = interview?.completedAt || interview?.endedAt || interview?.updatedAt || interview?.createdAt || null;
        if (!current.latestCompletedAt || Date.parse(completedAt || '') > Date.parse(current.latestCompletedAt || '')) {
          current.latestCompletedAt = completedAt;
        }

        candidateStats.set(candidateId, current);
      });

      const summaries = await userStore.getSummaries(Array.from(candidateStats.keys()));
      const leaderboard = Array.from(candidateStats.values())
        .map((entry, index) => {
          const averageScore = entry.scoredInterviews > 0
            ? Math.round((entry.scoreSum / entry.scoredInterviews) * 10) / 10
            : null;
          const summary = summaries.get(entry.userId) || null;

          return {
            rankSeed: index + 1,
            userId: entry.userId,
            displayName: buildCandidateLeaderboardDisplayName(summary, index + 1),
            profilePhotoUrl: summary?.profilePhotoUrl || null,
            averageScore,
            bestScore: entry.bestScore != null ? Math.round(entry.bestScore * 10) / 10 : null,
            scoredInterviews: entry.scoredInterviews,
            latestCompletedAt: entry.latestCompletedAt || null,
          };
        })
        .sort((left, right) => {
          if ((right.averageScore || 0) !== (left.averageScore || 0)) {
            return (right.averageScore || 0) - (left.averageScore || 0);
          }
          if ((right.bestScore || 0) !== (left.bestScore || 0)) {
            return (right.bestScore || 0) - (left.bestScore || 0);
          }
          if ((right.scoredInterviews || 0) !== (left.scoredInterviews || 0)) {
            return (right.scoredInterviews || 0) - (left.scoredInterviews || 0);
          }
          return Date.parse(right.latestCompletedAt || '') - Date.parse(left.latestCompletedAt || '');
        })
        .slice(0, 20)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1,
        }));

      return res.json({
        success: true,
        leaderboard,
      });
    } catch (error) {
      logger.error('Get score leaderboard error:', error);
      return next(error);
    }
  }

  static async submitAnswer(req, res, next) {
    try {
      const { id } = req.params;
      const { questionId, answer, audioUrl } = req.body;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req);
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      if (interview.status !== 'IN_PROGRESS') {
        return res.status(400).json({ error: 'Interview is not in progress' });
      }

      const question = (interview.questions || []).find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      const askedAtDate = question.askedAt ? new Date(question.askedAt) : new Date();
      const answeredAt = new Date();
      const timeToAnswer = Math.floor((answeredAt.getTime() - askedAtDate.getTime()) / 1000);

      const updatedQuestion = await interviewStore.updateQuestion(id, questionId, {
        answer,
        answerAudioUrl: audioUrl || null,
        askedAt: question.askedAt || askedAtDate.toISOString(),
        answeredAt: answeredAt.toISOString(),
        timeToAnswer,
      });

      let evaluation = null;
      let resolvedScore = null;
      let rubricScore = null;
      let criterionScores = [];
      let followUpQuestion = null;
      let followUpMetadata = null;
      try {
        evaluation = await LLMService.analyzeAnswer({
          question: question.question,
          answer,
          criteria: question.evaluationCriteria,
          difficulty: question.difficulty,
          rubric: question.rubric || null,
          llmOptions: resolveInterviewLlmOptions(interview.config),
        });

        criterionScores = Array.isArray(evaluation?.criterionScores) ? evaluation.criterionScores : [];
        rubricScore = computeRubricWeightedScore({
          rubric: question.rubric || null,
          criterionScores,
        });
        resolvedScore = reconcileQuestionScore({
          llmScore: evaluation?.score,
          rubricScore,
        });

        followUpQuestion = evaluation?.suggestions?.[0] || null;
        const followUpEnabled = interview?.config?.advancedSettings?.followUpQuestions !== false;
        if (followUpEnabled && question?.rubric && Number.isFinite(resolvedScore) && resolvedScore < 7.5) {
          try {
            followUpMetadata = await LLMService.generateRubricFollowUpQuestion({
              question: question.question,
              answer,
              analysis: evaluation,
              rubric: question.rubric,
              llmOptions: resolveInterviewLlmOptions(interview.config),
            });
            if (followUpMetadata?.question) {
              followUpQuestion = followUpMetadata.question;
            }
          } catch (followUpError) {
            logger.warn('Failed to generate rubric follow-up question:', followUpError);
          }
        }

        await interviewStore.updateQuestion(id, questionId, {
          score: resolvedScore ?? evaluation?.score ?? null,
          rubricScore: rubricScore ?? null,
          criterionScores,
          strengths: evaluation.strengths || [],
          weaknesses: evaluation.weaknesses || [],
          feedback: evaluation || null,
          followUpQuestion,
          followUpMetadata: followUpMetadata || null,
        });
      } catch (evalError) {
        logger.error('Error evaluating answer:', evalError);
      }

      try {
        await recordRealtimeEvent(id, 'answer-submitted', {
          actor: req.user.id,
          questionId,
          answeredAt: updatedQuestion.answeredAt || answeredAt.toISOString(),
          score: resolvedScore ?? evaluation?.score ?? updatedQuestion?.score ?? null,
        });
      } catch (eventError) {
        logger.warn('Failed to publish answer-submitted realtime event:', eventError);
      }

      const responseQuestion = {
        ...updatedQuestion,
        score: resolvedScore ?? evaluation?.score ?? updatedQuestion?.score ?? null,
        rubricScore: rubricScore ?? null,
        criterionScores,
        strengths: evaluation?.strengths || [],
        weaknesses: evaluation?.weaknesses || [],
        feedback: evaluation || null,
        followUpQuestion,
        followUpMetadata: followUpMetadata || null,
      };

      res.json({
        success: true,
        question: responseQuestion,
        evaluation,
        followUpQuestion,
        followUpMetadata,
      });
    } catch (error) {
      logger.error('Submit answer error:', error);
      next(error);
    }
  }

  static async markQuestionAsked(req, res, next) {
    try {
      const { id } = req.params;
      const { questionId } = req.body;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req);
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      const askedAt = new Date().toISOString();
      await interviewStore.updateQuestion(id, questionId, {
        askedAt,
      });

      try {
        await recordRealtimeEvent(id, 'question-asked', {
          actor: req.user.id,
          questionId,
          askedAt,
        });
      } catch (eventError) {
        logger.warn('Failed to publish question-asked realtime event:', eventError);
      }

      res.json({ success: true, questionId });
    } catch (error) {
      logger.error('Mark question asked error:', error);
      next(error);
    }
  }

  // GAP FEATURE: Save prep notes for a question
  static async saveQuestionNotes(req, res, next) {
    try {
      const { id, questionId } = req.params;
      const { prepNotes } = req.body;
      
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      const tokenAccess = enforceCandidateMeetingTokenAccess(interview, req);
      if (!tokenAccess.allowed) {
        return res.status(tokenAccess.status).json({ error: tokenAccess.message, code: tokenAccess.code });
      }

      // Validate question exists
      const questions = (interview.questions || []);
      const question = questions.find((q) => q.id === questionId);
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }

      // Update question with prep notes
      await interviewStore.updateQuestion(id, questionId, {
        prepNotes: prepNotes || '',
      });

      res.json({ 
        success: true, 
        message: 'Prep notes saved',
        questionId,
      });
    } catch (error) {
      logger.error('Save question notes error:', error);
      next(error);
    }
  }

  static async createShareToken(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getById(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
      }

      if (interview.status !== 'COMPLETED') {
        return res.status(400).json({ error: 'Only completed interviews can be shared.' });
      }

      // Reuse existing token or generate new one
      const token = interview.shareToken || crypto.randomBytes(20).toString('hex');
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

      await interviewStore.update(id, { shareToken: token, shareTokenExpiresAt: expiresAt });

      res.json({ success: true, token, expiresAt });
    } catch (error) {
      logger.error('Create share token error:', error);
      next(error);
    }
  }

  static async getSharedResults(req, res, next) {
    try {
      const { token } = req.params;
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ error: 'Invalid token.' });
      }

      const interviews = await interviewStore.findByShareToken(token);
      if (!interviews || interviews.length === 0) {
        return res.status(404).json({ error: 'Shared results not found or token has expired.' });
      }

      const interview = interviews[0];
      if (interview.shareTokenExpiresAt && new Date(interview.shareTokenExpiresAt) < new Date()) {
        return res.status(410).json({ error: 'This share link has expired.' });
      }

      const safeInterview = {
        jobRole: interview.jobRole || interview.position || 'Interview',
        completedAt: interview.completedAt || interview.endedAt || interview.updatedAt,
        overallScore: interview.overallScore,
        readinessLevel: interview.readinessLevel,
        evaluation: interview.evaluation,
        questions: (interview.questions || []).map((q) => ({
          question: q.question,
          score: q.score,
          feedback: q.feedback,
          strengths: q.strengths,
          weaknesses: q.weaknesses,
        })),
      };

      res.json({ success: true, interview: safeInterview });
    } catch (error) {
      logger.error('Get shared results error:', error);
      next(error);
    }
  }
}
