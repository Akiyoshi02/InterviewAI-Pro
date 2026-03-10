export const INTERVIEW_STAGE_CATEGORY_OPTIONS = [
  { value: 'SCREENING', label: 'Screening' },
  { value: 'TECHNICAL', label: 'Technical' },
  { value: 'PANEL', label: 'Panel' },
  { value: 'FINAL', label: 'Final' },
];

export const INTERVIEW_STAGE_ADVANCE_RULE_OPTIONS = [
  { value: 'PASS_REQUIRED', label: 'Pass required to continue' },
  { value: 'COMPLETE_TO_CONTINUE', label: 'Completion is enough to continue' },
];

export const INTERVIEW_STAGE_FAIL_DISPOSITION_OPTIONS = [
  { value: '', label: 'Manual decision after fail' },
  { value: 'NOT_SELECTED', label: 'Reject candidate on fail' },
  { value: 'SKILL_MISMATCH', label: 'Reject for skill mismatch' },
  { value: 'EXPERIENCE_MISMATCH', label: 'Reject for experience mismatch' },
  { value: 'OTHER', label: 'Reject with custom follow-up' },
];

export const INTERVIEW_TYPE_OPTIONS = [
  { label: 'Behavioral', value: 'BEHAVIORAL' },
  { label: 'Technical', value: 'TECHNICAL' },
  { label: 'Coding', value: 'CODING' },
  { label: 'System Design', value: 'SYSTEM_DESIGN' },
  { label: 'Case Study', value: 'CASE_STUDY' },
];

const STAGE_CATEGORY_VALUES = new Set(INTERVIEW_STAGE_CATEGORY_OPTIONS.map((option) => option.value));
const STAGE_ADVANCE_RULE_VALUES = new Set(INTERVIEW_STAGE_ADVANCE_RULE_OPTIONS.map((option) => option.value));
const INTERVIEW_TYPE_VALUES = new Set(INTERVIEW_TYPE_OPTIONS.map((option) => option.value));
const STAGE_FAIL_DISPOSITION_VALUES = new Set(
  INTERVIEW_STAGE_FAIL_DISPOSITION_OPTIONS
    .map((option) => option.value)
    .filter(Boolean),
);

const normalizeInterviewTypes = (value = []) => (
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim().toUpperCase())
        .filter((item) => INTERVIEW_TYPE_VALUES.has(item)),
    ),
  )
);

const normalizeStringArray = (value = []) => (
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    ),
  )
);

export const parseInterviewPlanSkillFocus = (value = '') => normalizeStringArray(
  String(value || '')
    .split(',')
    .map((item) => item.trim()),
);

export const formatInterviewPlanSkillFocus = (value = []) => normalizeStringArray(value).join(', ');

export const createDefaultInterviewPlanStage = (
  index = 0,
  {
    duration = 30,
    interviewTypes = ['BEHAVIORAL'],
    skillFocus = [],
  } = {},
) => ({
  id: `stage-${index + 1}`,
  name: `Interview Stage ${index + 1}`,
  category: index === 0 ? 'SCREENING' : (index === 2 ? 'FINAL' : 'TECHNICAL'),
  required: index !== 2,
  advanceRule: 'PASS_REQUIRED',
  autoAdvanceOnPass: false,
  autoAdvanceOnComplete: false,
  failDispositionCode: null,
  templateId: null,
  durationMinutes: Number.parseInt(duration, 10) || 30,
  interviewTypes: normalizeInterviewTypes(interviewTypes).length > 0
    ? normalizeInterviewTypes(interviewTypes)
    : ['BEHAVIORAL'],
  skillFocus: normalizeStringArray(skillFocus),
});

export const buildDefaultInterviewPlanStages = ({
  duration = 30,
  interviewTypes = ['BEHAVIORAL', 'TECHNICAL'],
  skillFocus = [],
} = {}) => ([
  {
    id: 'recruiter-screen',
    name: 'Recruiter Screen',
    category: 'SCREENING',
    required: true,
    advanceRule: 'PASS_REQUIRED',
    autoAdvanceOnPass: false,
    autoAdvanceOnComplete: false,
    failDispositionCode: null,
    templateId: null,
    durationMinutes: Math.min(Math.max(Number.parseInt(duration, 10) || 30, 15), 45),
    interviewTypes: normalizeInterviewTypes(interviewTypes).filter((type) => ['BEHAVIORAL'].includes(type)).length > 0
      ? normalizeInterviewTypes(interviewTypes).filter((type) => ['BEHAVIORAL'].includes(type))
      : ['BEHAVIORAL'],
    skillFocus: normalizeStringArray(skillFocus).slice(0, 3),
  },
  {
    id: 'sme-interview',
    name: 'SME Interview',
    category: 'TECHNICAL',
    required: true,
    advanceRule: 'PASS_REQUIRED',
    autoAdvanceOnPass: false,
    autoAdvanceOnComplete: false,
    failDispositionCode: null,
    templateId: null,
    durationMinutes: Math.min(Math.max(Number.parseInt(duration, 10) || 45, 30), 90),
    interviewTypes: normalizeInterviewTypes(interviewTypes).filter((type) => type !== 'BEHAVIORAL').length > 0
      ? normalizeInterviewTypes(interviewTypes).filter((type) => type !== 'BEHAVIORAL')
      : ['TECHNICAL'],
    skillFocus: normalizeStringArray(skillFocus),
  },
  {
    id: 'final-interview',
    name: 'Final Interview',
    category: 'FINAL',
    required: false,
    advanceRule: 'PASS_REQUIRED',
    autoAdvanceOnPass: false,
    templateId: null,
    durationMinutes: 30,
    interviewTypes: ['BEHAVIORAL'],
    skillFocus: [],
  },
]);

const normalizeStageId = (value, index) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || `stage-${index + 1}`;
};

export const normalizeInterviewPlanStage = (stage = {}, index = 0, defaults = {}) => {
  const resolvedInterviewTypes = normalizeInterviewTypes(stage.interviewTypes).length > 0
    ? normalizeInterviewTypes(stage.interviewTypes)
    : normalizeInterviewTypes(defaults.interviewTypes);

  return {
    id: normalizeStageId(stage.id || stage.name, index),
    name: String(stage.name || `Interview Stage ${index + 1}`).trim() || `Interview Stage ${index + 1}`,
    category: STAGE_CATEGORY_VALUES.has(String(stage.category || '').trim().toUpperCase())
      ? String(stage.category || '').trim().toUpperCase()
      : 'SCREENING',
    required: stage.required !== false,
    advanceRule: STAGE_ADVANCE_RULE_VALUES.has(String(stage.advanceRule || '').trim().toUpperCase())
      ? String(stage.advanceRule || '').trim().toUpperCase()
      : 'PASS_REQUIRED',
    autoAdvanceOnPass: stage.autoAdvanceOnPass === true,
    autoAdvanceOnComplete: stage.autoAdvanceOnComplete === true,
    failDispositionCode: STAGE_FAIL_DISPOSITION_VALUES.has(String(stage.failDispositionCode || '').trim().toUpperCase())
      ? String(stage.failDispositionCode || '').trim().toUpperCase()
      : null,
    templateId: typeof stage.templateId === 'string' && stage.templateId.trim()
      ? stage.templateId.trim()
      : null,
    durationMinutes: Math.max(
      15,
      Number.parseInt(stage.durationMinutes ?? defaults.duration ?? 30, 10) || 30,
    ),
    interviewTypes: resolvedInterviewTypes.length > 0 ? resolvedInterviewTypes : ['BEHAVIORAL'],
    skillFocus: normalizeStringArray(stage.skillFocus ?? defaults.skillFocus),
  };
};

export const normalizeInterviewPlanStages = (stages = [], defaults = {}) => {
  const source = Array.isArray(stages) && stages.length > 0
    ? stages
    : buildDefaultInterviewPlanStages(defaults);

  return source.map((stage, index) => normalizeInterviewPlanStage(stage, index, defaults));
};

export const normalizeJobTemplateConfig = (value = {}) => {
  const base = value && typeof value === 'object' ? value : {};
  const duration = Math.max(15, Number.parseInt(base.duration, 10) || 30);
  const interviewTypes = normalizeInterviewTypes(base.interviewTypes).length > 0
    ? normalizeInterviewTypes(base.interviewTypes)
    : ['BEHAVIORAL', 'TECHNICAL'];
  const skillFocus = normalizeStringArray(base.skillFocus);
  const stages = normalizeInterviewPlanStages(base?.interviewPlan?.stages, {
    duration,
    interviewTypes,
    skillFocus,
  });

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
