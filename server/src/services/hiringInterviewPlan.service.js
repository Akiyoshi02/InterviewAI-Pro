import {
  interviewStore,
  jobApplicationStore,
  jobStore,
  organizationStore,
  userStore,
} from './firebaseData.service.js';
import { normalizeApplicationStatus } from '../utils/applicationLifecycle.util.js';
import {
  findConstraintBasedAutoScheduleSlot,
  isNonTerminalScheduledInterview,
  resolveInterviewAutomationSettings,
} from './interviewScheduling.service.js';
import { generateMeetingToken } from './meetingLink.service.js';
import { syncReviewRequests } from '../utils/reviewRequest.util.js';
import {
  applyInterviewToPlanStage,
  buildInterviewPlanSnapshot,
  buildInterviewPlanStageMeta,
  canAdvanceFromInterviewPlanStage,
  getCurrentInterviewPlanStage,
  getInterviewPlanStage,
  getNextInterviewPlanStage,
  markInterviewPlanStageCompleted,
  normalizeInterviewPlanSnapshot,
} from '../utils/interviewPlan.util.js';
import logger from '../utils/logger.js';

const TERMINAL_INTERVIEW_STATUSES = new Set(['COMPLETED', 'CANCELLED']);

const normalizeReviewerAssignments = (value = []) => (
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  )
);

const resolveAutomationRecruiterContext = async ({
  application,
  recruiter,
  interview,
} = {}) => {
  const linkedRecruiterId = typeof interview?.companyId === 'string' && interview.companyId.trim()
    ? interview.companyId.trim()
    : null;
  const actingRecruiterId = typeof recruiter?.id === 'string' && recruiter.id.trim()
    ? recruiter.id.trim()
    : null;
  const reviewedByRecruiterId = typeof application?.reviewedBy === 'string' && application.reviewedBy.trim()
    ? application.reviewedBy.trim()
    : null;
  const recruiterId = linkedRecruiterId || actingRecruiterId || reviewedByRecruiterId || null;

  if (!recruiterId) {
    return {
      recruiterId: null,
      recruiterRecord: null,
      warning: null,
    };
  }

  try {
    const recruiterRecord = await userStore.getById(recruiterId);
    if (recruiterRecord) {
      return {
        recruiterId,
        recruiterRecord,
        warning: null,
      };
    }
    return {
      recruiterId,
      recruiterRecord: null,
      warning: 'Assigned recruiter availability could not be loaded. Interview was created without automatic scheduling.',
    };
  } catch (error) {
    logger.warn(`Failed to load recruiter ${recruiterId} for interview-plan automation:`, error);
    return {
      recruiterId,
      recruiterRecord: null,
      warning: 'Assigned recruiter availability could not be loaded. Interview was created without automatic scheduling.',
    };
  }
};

const loadSchedulingCandidates = async ({
  application,
  recruiterId,
  settings,
  interviewIdToExclude = null,
} = {}) => {
  if (!application || !settings?.autoScheduleEnabled) return [];

  let interviews = [];
  if (settings.conflictScope === 'ORGANIZATION' || !recruiterId) {
    interviews = await interviewStore.listByOrganization(application.organizationId, { limit: 200 });
  } else {
    interviews = await interviewStore.listByCompany(recruiterId, { limit: 200 });
  }

  return interviews.filter((interview) => (
    interview
    && interview.id
    && interview.id !== interviewIdToExclude
    && isNonTerminalScheduledInterview(interview)
  ));
};

const derivePipelineStatusForStageCategory = (category) => {
  const normalized = String(category || '').trim().toUpperCase();
  if (normalized === 'SCREENING') return 'SCREENING';
  if (normalized === 'FINAL') return 'FINAL';
  return 'INTERVIEW';
};

const buildStageScopedSettings = (settings, stage) => ({
  ...settings,
  durationMinutes: Number(stage?.durationMinutes) || settings.durationMinutes,
  interviewTypes: Array.isArray(stage?.interviewTypes) && stage.interviewTypes.length > 0
    ? stage.interviewTypes
    : settings.interviewTypes,
  skillFocus: Array.isArray(stage?.skillFocus) && stage.skillFocus.length > 0
    ? stage.skillFocus
    : settings.skillFocus,
});

const resolveLinkedApplicationForInterview = async (interview) => {
  if (!interview) return null;
  if (interview.applicationId) {
    const application = await jobApplicationStore.getById(interview.applicationId).catch(() => null);
    if (application) return application;
  }
  if (interview.jobId && interview.candidateId) {
    return jobApplicationStore.checkDuplicate(interview.jobId, interview.candidateId).catch(() => null);
  }
  return null;
};

const buildStageInterviewPayload = ({
  application,
  job,
  organization,
  plan,
  stage,
  settings,
  assignedRecruiterId,
  nowIso,
} = {}) => {
  const stageSettings = buildStageScopedSettings(settings, stage);
  const initialReviewRequests = syncReviewRequests({
    existingReviewRequests: [],
    reviewerAssignments: normalizeReviewerAssignments(stage?.reviewerAssignments),
    assignedBy: assignedRecruiterId,
    interview: {
      scheduledFor: null,
      completedAt: null,
      duration: stageSettings.durationMinutes,
    },
    nowValue: nowIso,
  });
  const stageMeta = buildInterviewPlanStageMeta(plan, stage);
  const templateId = typeof stage?.templateId === 'string' && stage.templateId.trim()
    ? stage.templateId.trim()
    : null;
  const interviewConfig = templateId
    ? {
      questionStrategy: {
        templateId,
      },
    }
    : null;

  return {
    mode: 'HIRING',
    candidateId: application.candidateId,
    companyId: assignedRecruiterId,
    organizationId: application.organizationId,
    applicationId: application.id,
    jobId: application.jobId,
    jobStage: stage?.name || 'Interview Stage',
    pipelineStatus: derivePipelineStatusForStageCategory(stage?.category),
    status: 'PENDING',
    scheduledFor: null,
    timezone: settings.timezone,
    scheduleStatus: null,
    scheduledBy: null,
    scheduledAt: null,
    jobRole: job.title || 'Position',
    experienceLevel: job.experienceLevel || 'MID',
    industry: job.department || organization?.industry || null,
    interviewTypes: stageSettings.interviewTypes,
    skillFocus: stageSettings.skillFocus,
    duration: stageSettings.durationMinutes,
    reviewerAssignments: normalizeReviewerAssignments(stage?.reviewerAssignments),
    reviewRequests: initialReviewRequests,
    config: interviewConfig,
    ...stageMeta,
  };
};

const applyAutoSchedulingToInterview = async ({
  interview,
  application,
  settings,
  recruiter,
  assignedRecruiterId,
  stage,
  forceReschedule = false,
} = {}) => {
  const shouldAttemptScheduling = settings.autoScheduleEnabled && interview;
  if (!shouldAttemptScheduling) {
    return {
      interview,
      scheduled: false,
      slotFound: false,
      selectedSlot: null,
      schedulingStats: null,
      warning: null,
    };
  }

  try {
    const candidates = await loadSchedulingCandidates({
      application,
      recruiterId: assignedRecruiterId,
      settings,
      interviewIdToExclude: interview.id,
    });
    const slotDecision = findConstraintBasedAutoScheduleSlot({
      settings,
      existingInterviews: candidates,
    });
    const selectedSlot = slotDecision.scheduledFor || null;
    if (!selectedSlot) {
      return {
        interview,
        scheduled: false,
        slotFound: false,
        selectedSlot: null,
        schedulingStats: {
          iterations: slotDecision.iterations || 0,
          conflictChecks: slotDecision.conflictChecks || 0,
          candidatePoolSize: candidates.length,
          conflictScope: settings.conflictScope,
          availabilitySource: settings.availabilitySource || 'ORGANIZATION',
          assignedRecruiterId,
          planStageId: stage?.id || null,
        },
        warning: null,
      };
    }

    const scheduledAt = new Date().toISOString();
    const nextReviewRequests = syncReviewRequests({
      existingReviewRequests: interview.reviewRequests,
      reviewerAssignments: interview.reviewerAssignments,
      assignedBy: recruiter?.id || assignedRecruiterId || null,
      interview: {
        ...interview,
        scheduledFor: selectedSlot,
        duration: interview.duration,
      },
      nowValue: scheduledAt,
    });
    const updatedInterview = await interviewStore.update(interview.id, {
      status: 'SCHEDULED',
      scheduledFor: selectedSlot,
      timezone: settings.timezone,
      ...generateMeetingToken(),
      scheduleStatus: forceReschedule ? 'RESCHEDULED' : 'SCHEDULED',
      scheduledBy: recruiter?.id || assignedRecruiterId || null,
      scheduledAt,
      reviewRequests: nextReviewRequests,
    });

    return {
      interview: updatedInterview,
      scheduled: true,
      slotFound: true,
      selectedSlot,
      schedulingStats: {
        iterations: slotDecision.iterations || 0,
        conflictChecks: slotDecision.conflictChecks || 0,
        candidatePoolSize: candidates.length,
        conflictScope: settings.conflictScope,
        availabilitySource: settings.availabilitySource || 'ORGANIZATION',
        assignedRecruiterId,
        planStageId: stage?.id || null,
      },
      warning: null,
    };
  } catch (error) {
    logger.warn('Interview-plan stage auto-scheduling failed:', error);
    return {
      interview,
      scheduled: false,
      slotFound: false,
      selectedSlot: null,
      schedulingStats: null,
      warning: 'Interview stage was created, but availability checks could not complete automatically. Schedule manually.',
    };
  }
};

export const ensureInterviewPlanStageForInterviewing = async ({
  application,
  job,
  organization,
  recruiter,
  reviewerAssignments = undefined,
  interviewSchedulingMode = null,
} = {}) => {
  if (!application || !job || !organization) {
    return { interview: null, created: false, scheduled: false, plan: null };
  }

  const forceAutoSchedule = interviewSchedulingMode === 'AUTO'
    ? true
    : interviewSchedulingMode === 'MANUAL'
      ? false
      : undefined;
  const nowIso = new Date().toISOString();
  let interview = null;
  let created = false;
  let scheduled = false;
  let slotFound = false;
  let selectedSlot = null;
  let schedulingStats = null;
  let warning = null;

  if (application.interviewId) {
    interview = await interviewStore.getById(application.interviewId).catch(() => null);
    if (interview && TERMINAL_INTERVIEW_STATUSES.has(String(interview.status || '').toUpperCase())) {
      interview = null;
    }
  }

  const recruiterContext = await resolveAutomationRecruiterContext({
    application,
    recruiter,
    interview,
  });
  const baseSettings = resolveInterviewAutomationSettings(
    organization,
    job,
    recruiterContext.recruiterRecord,
    { forceAutoSchedule },
  );
  const plan = buildInterviewPlanSnapshot({
    application,
    job,
    settings: baseSettings,
    reviewerAssignments,
    nowValue: nowIso,
  });
  const currentStage = getCurrentInterviewPlanStage(plan);
  if (!currentStage) {
    return { interview: null, created: false, scheduled: false, plan };
  }

  const assignedRecruiterId = recruiterContext.recruiterId || null;
  warning = recruiterContext.warning || null;

  if (currentStage.interviewId) {
    const existingStageInterview = await interviewStore.getById(currentStage.interviewId).catch(() => null);
    if (existingStageInterview && !TERMINAL_INTERVIEW_STATUSES.has(String(existingStageInterview.status || '').toUpperCase())) {
      interview = existingStageInterview;
    }
  }

  if (!interview && application.interviewId && !currentStage.interviewId) {
    const currentInterview = await interviewStore.getById(application.interviewId).catch(() => null);
    if (currentInterview && !TERMINAL_INTERVIEW_STATUSES.has(String(currentInterview.status || '').toUpperCase())) {
      interview = currentInterview;
    }
  }

  let nextPlan = plan;
  if (!interview) {
    interview = await interviewStore.create(buildStageInterviewPayload({
      application,
      job,
      organization,
      plan,
      stage: currentStage,
      settings: baseSettings,
      assignedRecruiterId,
      nowIso,
    }));
    created = true;
    nextPlan = applyInterviewToPlanStage(plan, currentStage.id, interview, nowIso);
  } else if (!currentStage.interviewId) {
    nextPlan = applyInterviewToPlanStage(plan, currentStage.id, interview, nowIso);
    await interviewStore.update(interview.id, {
      applicationId: application.id,
      ...(typeof currentStage?.templateId === 'string' && currentStage.templateId.trim()
        ? {
          config: {
            ...(interview?.config && typeof interview.config === 'object' ? interview.config : {}),
            questionStrategy: {
              ...(
                interview?.config?.questionStrategy
                && typeof interview.config.questionStrategy === 'object'
                  ? interview.config.questionStrategy
                  : {}
              ),
              templateId: currentStage.templateId.trim(),
            },
          },
        }
        : {}),
      ...buildInterviewPlanStageMeta(nextPlan, currentStage),
      jobStage: currentStage.name,
      pipelineStatus: derivePipelineStatusForStageCategory(currentStage.category),
    });
    interview = await interviewStore.getById(interview.id).catch(() => interview);
  }

  const stageSettings = buildStageScopedSettings(baseSettings, currentStage);
  if (!(assignedRecruiterId && !recruiterContext.recruiterRecord)) {
    const schedulingResult = await applyAutoSchedulingToInterview({
      interview,
      application,
      settings: stageSettings,
      recruiter,
      assignedRecruiterId,
      stage: currentStage,
    });
    interview = schedulingResult.interview;
    scheduled = schedulingResult.scheduled;
    slotFound = schedulingResult.slotFound;
    selectedSlot = schedulingResult.selectedSlot;
    schedulingStats = schedulingResult.schedulingStats;
    warning = schedulingResult.warning || warning;
  }

  await jobApplicationStore.update(application.id, {
    interviewId: interview.id,
    interviewPlan: nextPlan,
  });

  return {
    interview,
    created,
    scheduled,
    slotFound,
    selectedSlot,
    schedulingStats,
    assignedRecruiterId,
    mode: baseSettings.autoScheduleEnabled ? 'AUTO' : 'MANUAL',
    strategy: 'CONSTRAINT_BASED_V1',
    warning,
    plan: nextPlan,
    currentStage: getInterviewPlanStage(nextPlan, nextPlan.currentStageId) || currentStage,
    scheduleDecision: {
      requestedAutoSchedule: baseSettings.autoScheduleEnabled,
      selectedSlot: selectedSlot || null,
      assignedRecruiterId,
      ...(schedulingStats || {}),
    },
  };
};

export const completeLinkedInterviewPlanStage = async ({
  interview,
  completedAt = new Date().toISOString(),
} = {}) => {
  if (!interview?.applicationId && !(interview?.jobId && interview?.candidateId)) {
    return { application: null, updated: false, plan: null };
  }

  const application = await resolveLinkedApplicationForInterview(interview);
  if (!application?.id || !application?.interviewPlan || !interview?.planStageId) {
    return { application, updated: false, plan: application?.interviewPlan || null };
  }

  const nextPlan = markInterviewPlanStageCompleted(application.interviewPlan, interview.planStageId, completedAt);
  const updatedApplication = await jobApplicationStore.update(application.id, {
    interviewPlan: nextPlan,
    interviewCompletedAt: completedAt,
  });
  return {
    application: updatedApplication,
    updated: true,
    plan: nextPlan,
  };
};

export const createNextInterviewPlanStage = async ({
  interview,
  recruiter,
  application: applicationOverride = null,
} = {}) => {
  if (!interview) {
    return { interview: null, created: false, scheduled: false, plan: null, done: false };
  }

  const application = applicationOverride?.id
    ? applicationOverride
    : await resolveLinkedApplicationForInterview(interview);
  if (!application?.id || !application.interviewPlan) {
    return { interview: null, created: false, scheduled: false, plan: application?.interviewPlan || null, done: false };
  }

  const applicationStatus = normalizeApplicationStatus(application.status);
  if (applicationStatus === 'REJECTED' || applicationStatus === 'OFFER' || applicationStatus === 'HIRED') {
    return {
      interview: null,
      created: false,
      scheduled: false,
      plan: application.interviewPlan,
      done: false,
      blocked: true,
      code: 'APPLICATION_NOT_ACTIVE_FOR_NEXT_STAGE',
      error: `Application is already ${applicationStatus}. No further interview stages can be created.`,
      currentStage: getInterviewPlanStage(application.interviewPlan, interview.planStageId) || null,
    };
  }

  const job = await jobStore.getById(application.jobId).catch(() => null);
  const organization = await organizationStore.getById(application.organizationId).catch(() => null);
  if (!job || !organization) {
    return { interview: null, created: false, scheduled: false, plan: application.interviewPlan, done: false };
  }

  const recruiterContext = await resolveAutomationRecruiterContext({
    application,
    recruiter,
    interview,
  });
  const baseSettings = resolveInterviewAutomationSettings(
    organization,
    job,
    recruiterContext.recruiterRecord,
  );
  const plan = normalizeInterviewPlanSnapshot(application.interviewPlan, {
    settings: baseSettings,
    nowValue: new Date().toISOString(),
  });
  const completedStage = getInterviewPlanStage(plan, interview.planStageId) || getCurrentInterviewPlanStage(plan);
  const advanceState = canAdvanceFromInterviewPlanStage(plan, completedStage?.id);
  if (!advanceState.allowed) {
    return {
      interview: null,
      created: false,
      scheduled: false,
      plan,
      done: false,
      blocked: true,
      code: advanceState.code,
      error: advanceState.reason,
      currentStage: completedStage,
    };
  }
  const nextStage = getNextInterviewPlanStage(plan, completedStage?.id);

  if (!nextStage) {
    return { interview: null, created: false, scheduled: false, plan, done: true };
  }

  if (nextStage.interviewId) {
    const existingInterview = await interviewStore.getById(nextStage.interviewId).catch(() => null);
    if (existingInterview && !TERMINAL_INTERVIEW_STATUSES.has(String(existingInterview.status || '').toUpperCase())) {
      await jobApplicationStore.update(application.id, {
        interviewId: existingInterview.id,
        interviewPlan: applyInterviewToPlanStage(plan, nextStage.id, existingInterview),
      });
      return {
        interview: existingInterview,
        created: false,
        scheduled: Boolean(existingInterview.scheduledFor),
        slotFound: Boolean(existingInterview.scheduledFor),
        plan: applyInterviewToPlanStage(plan, nextStage.id, existingInterview),
        done: false,
        currentStage: nextStage,
        assignedRecruiterId: recruiterContext.recruiterId || null,
        warning: recruiterContext.warning || null,
      };
    }
  }

  const nowIso = new Date().toISOString();
  const assignedRecruiterId = recruiterContext.recruiterId || null;
  const createdInterview = await interviewStore.create(buildStageInterviewPayload({
    application,
    job,
    organization,
    plan,
    stage: nextStage,
    settings: baseSettings,
    assignedRecruiterId,
    nowIso,
  }));
  const nextPlan = applyInterviewToPlanStage(plan, nextStage.id, createdInterview, nowIso);

  const stageSettings = buildStageScopedSettings(baseSettings, nextStage);
  let finalInterview = createdInterview;
  let scheduled = false;
  let slotFound = false;
  let selectedSlot = null;
  let schedulingStats = null;
  let warning = recruiterContext.warning || null;

  if (!(assignedRecruiterId && !recruiterContext.recruiterRecord)) {
    const schedulingResult = await applyAutoSchedulingToInterview({
      interview: createdInterview,
      application,
      settings: stageSettings,
      recruiter,
      assignedRecruiterId,
      stage: nextStage,
    });
    finalInterview = schedulingResult.interview;
    scheduled = schedulingResult.scheduled;
    slotFound = schedulingResult.slotFound;
    selectedSlot = schedulingResult.selectedSlot;
    schedulingStats = schedulingResult.schedulingStats;
    warning = schedulingResult.warning || warning;
  }

  await jobApplicationStore.update(application.id, {
    interviewId: finalInterview.id,
    interviewPlan: nextPlan,
  });

  return {
    interview: finalInterview,
    created: true,
    scheduled,
    slotFound,
    selectedSlot,
    schedulingStats,
    assignedRecruiterId,
    warning,
    plan: nextPlan,
    done: false,
    currentStage: nextStage,
    scheduleDecision: {
      requestedAutoSchedule: baseSettings.autoScheduleEnabled,
      selectedSlot: selectedSlot || null,
      assignedRecruiterId,
      ...(schedulingStats || {}),
    },
  };
};
