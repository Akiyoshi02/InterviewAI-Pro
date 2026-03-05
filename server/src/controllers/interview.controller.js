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
import { generateMeetingToken, validateMeetingAccess } from '../services/meetingLink.service.js';
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
  normalizeApplicationStatus,
} from '../utils/applicationLifecycle.util.js';
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

  return { allowed: true };
};

const canCreateHiringInterview = (role) => {
  const normalizedRole = String(role || '').toUpperCase();
  return normalizedRole === 'ADMIN' || normalizedRole === 'RECRUITER';
};

const SCHEDULING_ROLES = new Set(['ADMIN', 'RECRUITER']);
const RECORDING_VIEW_ROLES = new Set(['ADMIN', 'RECRUITER', 'REVIEWER']);
const DEFAULT_TIMEZONE = process.env.DEFAULT_INTERVIEW_TIMEZONE || 'UTC';
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
const MAX_PREFERRED_RESCHEDULE_SLOTS = 3;
const INTERVIEW_SCHEDULING_STRATEGIES = new Set(['MANUAL', 'AUTO', 'PREFERRED_FIRST']);

const normalizeIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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
  const participantMap = await userStore.getSummaries([interview.candidateId, interview.companyId].filter(Boolean));

  return enrichInterviewSchedulingMeta({
    ...interview,
    candidate: interview.candidateId ? participantMap.get(interview.candidateId) || null : null,
    company: interview.companyId ? participantMap.get(interview.companyId) || null : null,
  });
};

const isTerminalInterviewStatus = (status) => {
  const normalized = String(status || '').toUpperCase();
  return normalized === 'COMPLETED' || normalized === 'CANCELLED';
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

const EVALUATION_RUN_ROLES = new Set(['ADMIN', 'RECRUITER', 'REVIEWER']);
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

  try {
    const evaluation = await LLMService.generateInterviewSummary({
      interview,
      questions,
      llmOptions,
    });
    const durationMs = Date.now() - startedAt;
    return {
      evaluation: {
        ...evaluation,
        status: 'COMPLETED',
        source: 'OLLAMA',
        generatedAt: evaluatedAt,
      },
      pendingEvaluation: false,
      llmUnavailable: false,
      message: null,
      reasonCode: null,
      metadata: {
        provider: 'ollama',
        model,
        evaluatedAt,
        durationMs,
        operation,
        pendingEvaluation: false,
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

const resolveSchedulingCandidates = async ({
  interview,
  settings,
  recruiterId,
  interviewIdToExclude = null,
} = {}) => {
  if (!interview || !settings) return [];

  let interviews = [];
  if (settings.conflictScope === 'ORGANIZATION' || !recruiterId) {
    interviews = await interviewStore.listByOrganization(interview.organizationId, { limit: 250 }).catch(() => []);
  } else {
    interviews = await interviewStore.listByCompany(recruiterId, { limit: 250 }).catch(() => []);
  }

  return interviews.filter((entry) => (
    entry
    && entry.id
    && entry.id !== interviewIdToExclude
    && isNonTerminalScheduledInterview(entry)
  ));
};

const resolveHiringSchedulingContext = async ({ interview, user }) => {
  if (!isHiringInterview(interview)) return null;
  if (String(user?.accountType || '').toUpperCase() !== 'COMPANY') return null;

  const [organization, job, recruiter] = await Promise.all([
    interview?.organizationId ? organizationStore.getById(interview.organizationId).catch(() => null) : null,
    interview?.jobId ? jobStore.getById(interview.jobId).catch(() => null) : null,
    user?.id ? userStore.getById(user.id).catch(() => null) : null,
  ]);

  if (!organization) return null;

  const recruiterContext = recruiter || user;
  const settings = resolveInterviewAutomationSettings(organization, job, recruiterContext, { forceAutoSchedule: true });
  const recruiterId = recruiterContext?.id || user?.id || interview?.companyId || null;
  const existingInterviews = await resolveSchedulingCandidates({
    interview,
    settings,
    recruiterId,
    interviewIdToExclude: interview.id,
  });

  return {
    settings,
    recruiterId,
    existingInterviews,
  };
};

const resolveScheduledForFromStrategy = ({
  strategy,
  scheduledFor,
  preferredSlots = [],
  schedulingContext,
  durationMinutes,
} = {}) => {
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
        invitationId,
        config,
        candidateId,
        status,
        pipelineStatus,
        reviewerAssignments,
        scheduledFor,
        timezone,
        scheduleStatus,
      } = req.body;
      const userId = req.user.id;
      const accountType = req.user.accountType;
      const organizationContext = req.user.organizationContext || null;
      const organizationId = organizationContext?.organization?.id || null;
      const organizationStatus = String(organizationContext?.organization?.status || '').toUpperCase();
      const organizationRole = String(organizationContext?.membership?.role || '').toUpperCase();
      const normalizedMode = String(mode || '').toUpperCase();
      const normalizedCandidateId = typeof candidateId === 'string' ? candidateId.trim() : null;
      const normalizedScheduledFor = scheduledFor || null;
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
        if (featureFlags.enableInvitations === false || featureFlags.enableJobPosting === false) {
          return res.status(503).json({
            error: 'Hiring interview creation is currently disabled by system administration.',
            code: 'FEATURE_DISABLED',
            feature: featureFlags.enableInvitations === false ? 'enableInvitations' : 'enableJobPosting',
          });
        }
      }

      let linkedApplication = null;
      if (normalizedMode === 'HIRING') {
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
          if (!linkedApplication && !invitationId) {
            return res.status(409).json({
              error: 'Candidate must have an application or invitation before creating a hiring interview',
              code: 'APPLICATION_OR_INVITATION_REQUIRED',
            });
          }

          if (linkedApplication) {
            const linkedStatus = normalizeApplicationStatus(linkedApplication.status);
            const allowPromotionViaInvitation = Boolean(invitationId);
            if (linkedStatus !== 'INTERVIEWING' && !allowPromotionViaInvitation) {
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
              interview: hydratedExisting,
              message: 'Existing active interview found',
              reusedExistingInterview: true,
            });
          }
        }
      }

      // For HIRING mode, use provided candidateId.
      // For PRACTICE mode, use the current user's ID.
      const finalCandidateId = normalizedMode === 'PRACTICE' ? userId : normalizedCandidateId;

      const interview = await interviewStore.create({
        mode: normalizedMode,
        candidateId: finalCandidateId,
        companyId: normalizedMode === 'HIRING' ? userId : null,
        organizationId: normalizedMode === 'HIRING' ? organizationId : null,
        jobId: jobId || null,
        jobStage: jobStage || null,
        invitationId: invitationId || null,
        status: status || defaultInterviewStatus,
        scheduledFor: normalizedScheduledFor,
        timezone: timezone || DEFAULT_TIMEZONE,
        ...(normalizedScheduledFor ? generateMeetingToken() : {}),
        scheduleStatus: scheduleStatus || (normalizedScheduledFor ? 'SCHEDULED' : null),
        scheduledBy: normalizedScheduledFor ? userId : null,
        scheduledAt: normalizedScheduledFor ? new Date().toISOString() : null,
        pipelineStatus: pipelineStatus || null,
        reviewerAssignments: Array.isArray(reviewerAssignments) ? reviewerAssignments : [],
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
        interview: hydrated,
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

      const hydrated = await attachSingleInterviewParticipants(interview);

      res.json({ success: true, interview: hydrated });
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
      return res.json({ success: true, interview: hydrated });
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
      } = req.body;
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

      const slotResolution = resolveScheduledForFromStrategy({
        strategy: schedulingStrategy,
        scheduledFor,
        preferredSlots: [],
        schedulingContext,
        durationMinutes: duration || interview?.duration,
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
      return res.json({ success: true, interview: hydrated });
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
      } = req.body;
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

      const preferredSlots = schedulingStrategy === 'PREFERRED_FIRST'
        ? (pendingRequest?.preferredSlots || [])
        : [];
      const slotResolution = resolveScheduledForFromStrategy({
        strategy: schedulingStrategy,
        scheduledFor,
        preferredSlots,
        schedulingContext,
        durationMinutes: duration || interview?.duration,
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
      return res.json({ success: true, interview: hydrated });
    } catch (error) {
      logger.error('Reschedule interview error:', error);
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
        interview: hydrated,
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
        interview: hydrated,
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
      return res.json({ success: true, interview: hydrated });
    } catch (error) {
      logger.error('Cancel interview error:', error);
      return next(error);
    }
  }

  static async uploadRecording(req, res, next) {
    try {
      const { id } = req.params;
      const interview = await interviewStore.getById(id);
      const access = canViewRecording(interview, req.user);
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
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
        interview: hydrated,
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
        interview: responseInterview,
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
      const updatedInterview = await interviewStore.update(id, {
        status: 'COMPLETED',
        endedAt: completionTimestamp,
        completedAt: completionTimestamp,
        evaluation,
        overallScore: pendingEvaluation ? null : evaluation?.overallScore ?? null,
        readinessLevel: pendingEvaluation ? null : evaluation?.readinessLevel ?? null,
        llmUnavailable,
        pendingEvaluation,
        llmUnavailableAt: llmUnavailable ? new Date().toISOString() : interview?.llmUnavailableAt || null,
        llmFallbackReason: pendingEvaluation ? reasonCode : null,
        evaluationMetadata: metadata,
      });

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

      res.json({
        success: true,
        interview: hydrated,
        pendingEvaluation: Boolean(hydrated?.pendingEvaluation),
        llmUnavailable: Boolean(hydrated?.llmUnavailable),
        message: hydrated?.pendingEvaluation
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
          interview: hydratedExisting,
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
        interview: hydrated,
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
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;

      const candidateInterviews = await interviewStore.listByCandidate(userId, { limit: listLimit });
      const companyInterviews = accountType === 'COMPANY'
        ? (organizationId
          ? await interviewStore.listByOrganization(organizationId, { limit: listLimit })
          : await interviewStore.listByCompany(userId, { limit: listLimit }))
        : [];

      const combinedMap = new Map();
      [...candidateInterviews, ...companyInterviews].forEach((interview) => {
        if (interview) combinedMap.set(interview.id, interview);
      });

      const interviewsArray = Array.from(combinedMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
      );

      const hydrated = (await hydrateInterviewParticipants(interviewsArray)).map((interview) =>
        enrichInterviewSchedulingMeta(interview),
      );

      res.json({ success: true, interviews: hydrated });
    } catch (error) {
      logger.error('Get my interviews error:', error);
      next(error);
    }
  }

  static async getCompanyInterviews(req, res, next) {
    try {
      const organizationId = req.user.organizationContext?.organization?.id || null;
      const companyId = req.user.id;
      const requestedLimit = Number.parseInt(req.query.limit, 10);
      const listLimit = Number.isInteger(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, 200)
        : 100;
      const interviews = organizationId
        ? await interviewStore.listByOrganization(organizationId, { limit: listLimit })
        : await interviewStore.listByCompany(companyId, { limit: listLimit });
      const hydrated = (await hydrateInterviewParticipants(interviews)).map((interview) =>
        enrichInterviewSchedulingMeta(interview),
      );

      res.json({ success: true, interviews: hydrated });
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

  static async submitAnswer(req, res, next) {
    try {
      const { id } = req.params;
      const { questionId, answer, audioUrl } = req.body;
      const interview = await interviewStore.getWithQuestions(id);
      const access = ensureAccess(interview, req.user, { allowOrganizationMembers: false });
      if (!access.allowed) {
        return res.status(access.status).json({ error: access.message });
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

      res.json({
        success: true,
        question: updatedQuestion,
        evaluation,
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
