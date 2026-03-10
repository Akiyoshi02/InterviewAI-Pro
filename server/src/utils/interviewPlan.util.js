import crypto from 'crypto';

const STAGE_CATEGORIES = new Set(['SCREENING', 'TECHNICAL', 'PANEL', 'FINAL']);
const STAGE_STATUSES = new Set(['PENDING', 'ACTIVE', 'COMPLETED', 'SKIPPED']);
const STAGE_ADVANCE_RULES = new Set(['PASS_REQUIRED', 'COMPLETE_TO_CONTINUE']);
const STAGE_OUTCOMES = new Set(['PENDING', 'PASS', 'FAIL', 'HOLD', 'SKIPPED']);
const STAGE_FAIL_DISPOSITION_CODES = new Set(['NOT_SELECTED', 'SKILL_MISMATCH', 'EXPERIENCE_MISMATCH', 'OTHER']);

const BEHAVIORAL_TYPES = new Set(['BEHAVIORAL', 'SITUATIONAL', 'CULTURE', 'SCREENING']);
const TECHNICAL_TYPES = new Set(['TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'CASE_STUDY']);

const normalizeStringArray = (value = []) => (
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  )
);

const normalizeInterviewTypes = (value = []) => (
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim().toUpperCase())
        .filter(Boolean),
    ),
  )
);

const toStageId = (value, fallbackPrefix = 'stage') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `${fallbackPrefix}-${crypto.randomUUID()}`;
};

const normalizeStageCategory = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return STAGE_CATEGORIES.has(normalized) ? normalized : 'SCREENING';
};

const normalizeStageStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return STAGE_STATUSES.has(normalized) ? normalized : 'PENDING';
};

const normalizeStageAdvanceRule = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return STAGE_ADVANCE_RULES.has(normalized) ? normalized : 'PASS_REQUIRED';
};

const normalizeStageFailDispositionCode = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  return STAGE_FAIL_DISPOSITION_CODES.has(normalized) ? normalized : null;
};

const normalizeStageOutcome = (value, status = null) => {
  if (String(status || '').trim().toUpperCase() === 'SKIPPED') {
    return 'SKIPPED';
  }
  const normalized = String(value || '').trim().toUpperCase();
  return STAGE_OUTCOMES.has(normalized) ? normalized : 'PENDING';
};

const buildDefaultInterviewPlanStages = ({
  settings = {},
  reviewerAssignments = [],
} = {}) => {
  const configuredTypes = normalizeInterviewTypes(settings.interviewTypes);
  const skillFocus = normalizeStringArray(settings.skillFocus);
  const behavioralTypes = configuredTypes.filter((type) => BEHAVIORAL_TYPES.has(type));
  const technicalTypes = configuredTypes.filter((type) => TECHNICAL_TYPES.has(type));

  const screeningTypes = behavioralTypes.length > 0
    ? behavioralTypes
    : (configuredTypes[0] ? [configuredTypes[0]] : ['BEHAVIORAL']);
  const technicalStageTypes = technicalTypes.length > 0
    ? technicalTypes
    : configuredTypes.filter((type) => !screeningTypes.includes(type));
  const finalTypes = behavioralTypes.length > 0 ? behavioralTypes : ['BEHAVIORAL'];

  return [
    {
      id: 'recruiter-screen',
      sequence: 1,
      name: 'Recruiter Screen',
      category: 'SCREENING',
      required: true,
      durationMinutes: Math.min(Math.max(Number(settings.durationMinutes) || 30, 15), 45),
      advanceRule: 'PASS_REQUIRED',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
      templateId: null,
      interviewTypes: screeningTypes,
      skillFocus: skillFocus.slice(0, 3),
      reviewerAssignments: [],
    },
    {
      id: 'sme-interview',
      sequence: 2,
      name: 'SME Interview',
      category: 'TECHNICAL',
      required: true,
      durationMinutes: Math.min(Math.max(Number(settings.durationMinutes) || 45, 30), 90),
      advanceRule: 'PASS_REQUIRED',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
      templateId: null,
      interviewTypes: technicalStageTypes.length > 0 ? technicalStageTypes : screeningTypes,
      skillFocus,
      reviewerAssignments: normalizeStringArray(reviewerAssignments),
    },
    {
      id: 'final-interview',
      sequence: 3,
      name: 'Final Interview',
      category: 'FINAL',
      required: false,
      durationMinutes: 30,
      advanceRule: 'PASS_REQUIRED',
      autoAdvanceOnPass: false,
      autoAdvanceOnComplete: false,
      failDispositionCode: null,
      templateId: null,
      interviewTypes: finalTypes,
      skillFocus: [],
      reviewerAssignments: [],
    },
  ];
};

const normalizeStageDefinition = (stage, index, fallbackStage = null) => {
  const fallback = fallbackStage && typeof fallbackStage === 'object' ? fallbackStage : {};
  const id = toStageId(stage?.id || stage?.key || stage?.name || fallback.id || `${fallback.name || 'stage'}-${index + 1}`);
  const durationMinutes = Math.max(
    15,
    Number.parseInt(stage?.durationMinutes ?? fallback.durationMinutes ?? 30, 10) || 30,
  );

  return {
    id,
    sequence: Number.parseInt(stage?.sequence ?? fallback.sequence ?? (index + 1), 10) || (index + 1),
    name: String(stage?.name || fallback.name || `Interview Stage ${index + 1}`).trim(),
    category: normalizeStageCategory(stage?.category || fallback.category),
    required: stage?.required !== undefined ? stage.required !== false : fallback.required !== false,
    durationMinutes,
    advanceRule: normalizeStageAdvanceRule(stage?.advanceRule || fallback.advanceRule),
    autoAdvanceOnPass: stage?.autoAdvanceOnPass === true || fallback.autoAdvanceOnPass === true,
    autoAdvanceOnComplete: stage?.autoAdvanceOnComplete === true || fallback.autoAdvanceOnComplete === true,
    failDispositionCode: normalizeStageFailDispositionCode(stage?.failDispositionCode || fallback.failDispositionCode),
    templateId: typeof stage?.templateId === 'string' && stage.templateId.trim()
      ? stage.templateId.trim()
      : (typeof fallback.templateId === 'string' && fallback.templateId.trim() ? fallback.templateId.trim() : null),
    interviewTypes: normalizeInterviewTypes(stage?.interviewTypes || fallback.interviewTypes),
    skillFocus: normalizeStringArray(stage?.skillFocus || fallback.skillFocus),
    reviewerAssignments: normalizeStringArray(stage?.reviewerAssignments || fallback.reviewerAssignments),
    status: normalizeStageStatus(stage?.status || fallback.status),
    outcome: normalizeStageOutcome(stage?.outcome || fallback.outcome, stage?.status || fallback.status),
    outcomeRecordedAt: stage?.outcomeRecordedAt || fallback.outcomeRecordedAt || null,
    outcomeRecordedBy: stage?.outcomeRecordedBy || fallback.outcomeRecordedBy || null,
    outcomeNote: typeof stage?.outcomeNote === 'string'
      ? stage.outcomeNote.trim() || null
      : (typeof fallback.outcomeNote === 'string' ? fallback.outcomeNote.trim() || null : null),
    interviewId: stage?.interviewId || fallback.interviewId || null,
    activatedAt: stage?.activatedAt || fallback.activatedAt || null,
    completedAt: stage?.completedAt || fallback.completedAt || null,
    skippedAt: stage?.skippedAt || fallback.skippedAt || null,
  };
};

export const buildInterviewPlanSnapshot = ({
  application = null,
  job = null,
  settings = {},
  reviewerAssignments = [],
  nowValue = new Date().toISOString(),
} = {}) => {
  const existingPlan = application?.interviewPlan && typeof application.interviewPlan === 'object'
    ? application.interviewPlan
    : null;

  if (existingPlan) {
    return normalizeInterviewPlanSnapshot(existingPlan, {
      settings,
      reviewerAssignments,
      nowValue,
    });
  }

  const configuredStages = Array.isArray(job?.templateConfig?.interviewPlan?.stages)
    ? job.templateConfig.interviewPlan.stages
    : [];
  const baseStages = configuredStages.length > 0
    ? configuredStages
    : buildDefaultInterviewPlanStages({ settings, reviewerAssignments });

  const stages = baseStages
    .map((stage, index) => normalizeStageDefinition(stage, index))
    .sort((left, right) => left.sequence - right.sequence);
  const firstStage = stages[0] || null;

  return {
    version: 1,
    source: configuredStages.length > 0 ? 'JOB_TEMPLATE' : 'DEFAULT',
    generatedAt: nowValue,
    status: firstStage ? 'IN_PROGRESS' : 'COMPLETED',
    currentStageId: firstStage?.id || null,
    stages,
  };
};

export const normalizeInterviewPlanSnapshot = (
  plan,
  {
    settings = {},
    reviewerAssignments = [],
    nowValue = new Date().toISOString(),
  } = {},
) => {
  if (!plan || typeof plan !== 'object') {
    return buildInterviewPlanSnapshot({ application: null, job: null, settings, reviewerAssignments, nowValue });
  }

  const configuredStages = Array.isArray(plan.stages) ? plan.stages : [];
  const fallbackStages = buildDefaultInterviewPlanStages({ settings, reviewerAssignments });
  const stages = configuredStages.length > 0
    ? configuredStages.map((stage, index) => normalizeStageDefinition(stage, index, fallbackStages[index]))
    : fallbackStages.map((stage, index) => normalizeStageDefinition(stage, index));

  stages.sort((left, right) => left.sequence - right.sequence);

  const currentStageId = stages.some((stage) => stage.id === plan.currentStageId)
    ? plan.currentStageId
    : (stages.find((stage) => stage.status === 'ACTIVE')?.id
      || stages.find((stage) => stage.status === 'PENDING')?.id
      || stages[stages.length - 1]?.id
      || null);
  const allComplete = stages.length > 0
    && stages.every((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED');

  return {
    version: Number.parseInt(plan.version, 10) || 1,
    source: String(plan.source || 'DEFAULT').trim().toUpperCase() || 'DEFAULT',
    generatedAt: plan.generatedAt || nowValue,
    status: allComplete ? 'COMPLETED' : 'IN_PROGRESS',
    currentStageId,
    stages,
  };
};

export const getInterviewPlanStage = (plan, stageId) => (
  Array.isArray(plan?.stages)
    ? plan.stages.find((stage) => stage.id === stageId) || null
    : null
);

export const getCurrentInterviewPlanStage = (plan) => {
  if (!plan || !Array.isArray(plan.stages) || plan.stages.length === 0) return null;
  return getInterviewPlanStage(plan, plan.currentStageId)
    || plan.stages.find((stage) => stage.status === 'ACTIVE')
    || plan.stages.find((stage) => stage.status === 'PENDING')
    || plan.stages[plan.stages.length - 1]
    || null;
};

export const getNextInterviewPlanStage = (plan, currentStageId) => {
  if (!plan || !Array.isArray(plan.stages) || plan.stages.length === 0) return null;
  const currentStage = getInterviewPlanStage(plan, currentStageId) || getCurrentInterviewPlanStage(plan);
  if (!currentStage) return null;
  return plan.stages.find((stage) => stage.sequence > currentStage.sequence && stage.status === 'PENDING') || null;
};

export const applyInterviewToPlanStage = (plan, stageId, interview, nowValue = new Date().toISOString()) => {
  const normalized = normalizeInterviewPlanSnapshot(plan, { nowValue });
  const stages = normalized.stages.map((stage) => (
    stage.id === stageId
      ? {
        ...stage,
        status: stage.status === 'COMPLETED' ? 'COMPLETED' : 'ACTIVE',
        interviewId: interview?.id || stage.interviewId || null,
        activatedAt: stage.activatedAt || nowValue,
      }
      : stage
  ));

  return {
    ...normalized,
    currentStageId: stageId,
    status: stages.every((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED')
      ? 'COMPLETED'
      : 'IN_PROGRESS',
    stages,
  };
};

export const markInterviewPlanStageCompleted = (plan, stageId, nowValue = new Date().toISOString()) => {
  const normalized = normalizeInterviewPlanSnapshot(plan, { nowValue });
  const stages = normalized.stages.map((stage) => (
    stage.id === stageId
      ? {
        ...stage,
        status: 'COMPLETED',
        completedAt: stage.completedAt || nowValue,
      }
      : stage
  ));
  const nextPendingStage = stages.find((stage) => stage.sequence > (getInterviewPlanStage(normalized, stageId)?.sequence || 0) && stage.status === 'PENDING')
    || stages.find((stage) => stage.status === 'PENDING')
    || null;

  return {
    ...normalized,
    currentStageId: nextPendingStage?.id || stageId || normalized.currentStageId,
    status: stages.every((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED')
      ? 'COMPLETED'
      : 'IN_PROGRESS',
    stages,
  };
};

export const updateInterviewPlanStageOutcome = (
  plan,
  stageId,
  {
    outcome,
    note = null,
    recordedAt = new Date().toISOString(),
    recordedBy = null,
  } = {},
) => {
  const normalized = normalizeInterviewPlanSnapshot(plan, { nowValue: recordedAt });
  const stages = normalized.stages.map((stage) => {
    if (stage.id !== stageId) return stage;
    const nextOutcome = normalizeStageOutcome(outcome, stage.status);
    return {
      ...stage,
      outcome: nextOutcome,
      outcomeRecordedAt: recordedAt,
      outcomeRecordedBy: recordedBy || null,
      outcomeNote: typeof note === 'string' && note.trim() ? note.trim() : null,
    };
  });

  return {
    ...normalized,
    stages,
  };
};

export const canAdvanceFromInterviewPlanStage = (plan, stageId) => {
  const normalized = normalizeInterviewPlanSnapshot(plan);
  const stage = getInterviewPlanStage(normalized, stageId) || getCurrentInterviewPlanStage(normalized);
  if (!stage) {
    return {
      allowed: false,
      code: 'INTERVIEW_STAGE_NOT_FOUND',
      reason: 'Interview stage could not be resolved.',
      stage: null,
    };
  }

  if (stage.status === 'SKIPPED') {
    return { allowed: true, code: 'SKIPPED_STAGE', reason: null, stage };
  }

  if (stage.status !== 'COMPLETED') {
    return {
      allowed: false,
      code: 'INTERVIEW_STAGE_NOT_COMPLETED',
      reason: 'Complete the current interview before advancing to the next stage.',
      stage,
    };
  }

  if (stage.advanceRule === 'COMPLETE_TO_CONTINUE') {
    if (stage.outcome === 'FAIL' || stage.outcome === 'HOLD') {
      return {
        allowed: false,
        code: 'INTERVIEW_STAGE_OUTCOME_BLOCKED',
        reason: stage.outcome === 'FAIL'
          ? 'This stage is marked as failed. Update the outcome before creating the next stage.'
          : 'This stage is on hold. Resolve the hold before creating the next stage.',
        stage,
      };
    }

    return { allowed: true, code: 'COMPLETE_TO_CONTINUE', reason: null, stage };
  }

  if (stage.outcome !== 'PASS') {
    return {
      allowed: false,
      code: 'INTERVIEW_STAGE_OUTCOME_REQUIRED',
      reason: 'Record a Pass outcome for this stage before creating the next stage.',
      stage,
    };
  }

  return { allowed: true, code: 'PASS_REQUIRED', reason: null, stage };
};

export const canMoveInterviewPlanToOffer = (plan) => {
  const normalized = normalizeInterviewPlanSnapshot(plan);
  const stages = Array.isArray(normalized?.stages) ? normalized.stages : [];
  if (stages.length === 0) {
    return {
      allowed: true,
      code: 'LEGACY_INTERVIEW_PLAN',
      reason: null,
      stage: null,
    };
  }

  const incompleteStage = stages.find((stage) => !['COMPLETED', 'SKIPPED'].includes(stage.status));
  if (incompleteStage) {
    return {
      allowed: false,
      code: 'INTERVIEW_PLAN_NOT_COMPLETE',
      reason: 'Complete all planned interview stages before moving this application to the offer stage.',
      stage: incompleteStage,
    };
  }

  const finalStage = stages[stages.length - 1] || null;
  const advanceState = canAdvanceFromInterviewPlanStage(normalized, finalStage?.id);
  if (!advanceState.allowed) {
    return {
      allowed: false,
      code: advanceState.code,
      reason: advanceState.reason || 'The final interview round is not ready for the offer stage yet.',
      stage: advanceState.stage || finalStage,
    };
  }

  return {
    allowed: true,
    code: 'INTERVIEW_PLAN_READY_FOR_OFFER',
    reason: null,
    stage: advanceState.stage || finalStage,
  };
};

export const buildInterviewPlanStageMeta = (plan, stage) => {
  const totalStages = Array.isArray(plan?.stages) ? plan.stages.length : 0;
  const normalizedStage = stage || getCurrentInterviewPlanStage(plan);
  if (!normalizedStage) {
    return {
      planStageId: null,
      planStageName: null,
      planStageSequence: null,
      planStageTotal: totalStages || null,
      planStageCategory: null,
    };
  }

  return {
    planStageId: normalizedStage.id,
    planStageName: normalizedStage.name,
    planStageSequence: normalizedStage.sequence,
    planStageTotal: totalStages || null,
    planStageCategory: normalizedStage.category,
  };
};

export const sanitizeInterviewPlanForClient = (plan) => {
  if (!plan || typeof plan !== 'object') return null;
  const normalized = normalizeInterviewPlanSnapshot(plan);
  return {
    version: normalized.version,
    source: normalized.source,
    generatedAt: normalized.generatedAt,
    status: normalized.status,
    currentStageId: normalized.currentStageId,
    stages: normalized.stages.map((stage) => ({
      id: stage.id,
      sequence: stage.sequence,
      name: stage.name,
      category: stage.category,
      required: stage.required,
      advanceRule: stage.advanceRule,
      autoAdvanceOnPass: stage.autoAdvanceOnPass === true,
      autoAdvanceOnComplete: stage.autoAdvanceOnComplete === true,
      failDispositionCode: stage.failDispositionCode || null,
      templateId: stage.templateId || null,
      status: stage.status,
      outcome: stage.outcome || 'PENDING',
      outcomeRecordedAt: stage.outcomeRecordedAt || null,
      outcomeRecordedBy: stage.outcomeRecordedBy || null,
      outcomeNote: stage.outcomeNote || null,
      durationMinutes: stage.durationMinutes,
      interviewTypes: stage.interviewTypes,
      skillFocus: stage.skillFocus,
      reviewerAssignments: stage.reviewerAssignments,
      interviewId: stage.interviewId,
      activatedAt: stage.activatedAt,
      completedAt: stage.completedAt,
      skippedAt: stage.skippedAt || null,
    })),
  };
};

export const normalizeInterviewPlanTemplateConfig = (templateConfig = {}) => {
  const base = templateConfig && typeof templateConfig === 'object' ? templateConfig : {};
  const duration = Math.max(15, Number.parseInt(base.duration, 10) || 30);
  const interviewTypes = normalizeInterviewTypes(base.interviewTypes).length > 0
    ? normalizeInterviewTypes(base.interviewTypes)
    : ['BEHAVIORAL', 'TECHNICAL'];
  const skillFocus = normalizeStringArray(base.skillFocus);
  const configuredStages = Array.isArray(base?.interviewPlan?.stages)
    ? base.interviewPlan.stages
    : [];

  const stages = (configuredStages.length > 0
    ? configuredStages.map((stage, index) => normalizeStageDefinition(stage, index, {
      durationMinutes: duration,
      interviewTypes,
      skillFocus,
    }))
    : buildDefaultInterviewPlanStages({
      settings: { durationMinutes: duration, interviewTypes, skillFocus },
      reviewerAssignments: [],
    }).map((stage, index) => normalizeStageDefinition(stage, index)))
    .sort((left, right) => left.sequence - right.sequence)
    .map((stage, index) => ({
      id: stage.id,
      sequence: index + 1,
      name: stage.name,
      category: stage.category,
      required: stage.required !== false,
      advanceRule: stage.advanceRule || 'PASS_REQUIRED',
      autoAdvanceOnPass: stage.autoAdvanceOnPass === true,
      autoAdvanceOnComplete: stage.autoAdvanceOnComplete === true,
      failDispositionCode: stage.failDispositionCode || null,
      templateId: stage.templateId || null,
      durationMinutes: stage.durationMinutes,
      interviewTypes: stage.interviewTypes,
      skillFocus: stage.skillFocus,
    }));

  return {
    ...base,
    duration,
    interviewTypes,
    skillFocus,
    interviewPlan: {
      ...(base.interviewPlan && typeof base.interviewPlan === 'object' ? base.interviewPlan : {}),
      stages,
    },
  };
};
