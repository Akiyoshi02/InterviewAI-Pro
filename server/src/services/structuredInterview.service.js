import crypto from 'crypto';
import {
  INTERVIEW_QUESTION_LIBRARY,
  INTERVIEW_QUESTION_TEMPLATES,
  QUESTION_LIBRARY_VERSION,
} from '../data/interviewQuestionLibrary.js';
import { getApprovedCatalog } from './questionCatalog.service.js';

const DIFFICULTY_ORDER = Object.freeze({ EASY: 1, MEDIUM: 2, HARD: 3 });

const QUESTION_TYPE_ALIASES = Object.freeze({
  BEHAVIORAL: 'BEHAVIORAL',
  BEHAVIOURAL: 'BEHAVIORAL',
  TECHNICAL: 'TECHNICAL',
  CODING: 'CODING',
  SYSTEM_DESIGN: 'SYSTEM_DESIGN',
  'SYSTEM DESIGN': 'SYSTEM_DESIGN',
  'SYSTEM-DESIGN': 'SYSTEM_DESIGN',
  SYSTEMDESIGN: 'SYSTEM_DESIGN',
  CASE_STUDY: 'CASE_STUDY',
  'CASE STUDY': 'CASE_STUDY',
  'CASE-STUDY': 'CASE_STUDY',
  CASESTUDY: 'CASE_STUDY',
  SITUATIONAL: 'BEHAVIORAL',
});

const STRUCTURED_TEMPLATE_MODES = new Set(['HIRING', 'PRACTICE']);

const RUBRIC_PRESETS = Object.freeze({
  BEHAVIORAL: {
    id: 'rubric-behavioral-star-v1',
    scale: { min: 1, max: 5 },
    dimensions: [
      { key: 'situation_task', label: 'Situation & Task Clarity', weight: 20 },
      { key: 'action_ownership', label: 'Action Ownership', weight: 30 },
      { key: 'result_impact', label: 'Result & Impact', weight: 25 },
      { key: 'communication', label: 'Communication Clarity', weight: 25 },
    ],
  },
  TECHNICAL: {
    id: 'rubric-technical-depth-v1',
    scale: { min: 1, max: 5 },
    dimensions: [
      { key: 'correctness', label: 'Technical Correctness', weight: 35 },
      { key: 'depth', label: 'Depth of Explanation', weight: 25 },
      { key: 'tradeoffs', label: 'Trade-off Analysis', weight: 20 },
      { key: 'communication', label: 'Technical Communication', weight: 20 },
    ],
  },
  CODING: {
    id: 'rubric-coding-v1',
    scale: { min: 1, max: 5 },
    dimensions: [
      { key: 'correctness', label: 'Implementation Correctness', weight: 40 },
      { key: 'complexity', label: 'Complexity Reasoning', weight: 25 },
      { key: 'edge_cases', label: 'Edge Case Handling', weight: 20 },
      { key: 'communication', label: 'Code Communication', weight: 15 },
    ],
  },
  SYSTEM_DESIGN: {
    id: 'rubric-system-design-v1',
    scale: { min: 1, max: 5 },
    dimensions: [
      { key: 'problem_framing', label: 'Problem Framing', weight: 20 },
      { key: 'architecture', label: 'Architecture Quality', weight: 30 },
      { key: 'scalability_reliability', label: 'Scalability & Reliability', weight: 30 },
      { key: 'tradeoffs_communication', label: 'Trade-offs & Communication', weight: 20 },
    ],
  },
  CASE_STUDY: {
    id: 'rubric-case-study-v1',
    scale: { min: 1, max: 5 },
    dimensions: [
      { key: 'problem_structuring', label: 'Problem Structuring', weight: 30 },
      { key: 'data_reasoning', label: 'Data / Evidence Reasoning', weight: 25 },
      { key: 'prioritization', label: 'Prioritization & Decision Quality', weight: 25 },
      { key: 'communication', label: 'Communication Clarity', weight: 20 },
    ],
  },
});

export const DEFAULT_HIRING_QUESTION_STRATEGY = Object.freeze({
  enabled: true,
  mode: 'HYBRID_TEMPLATE',
  enforceCoreQuestions: true,
  coreQuestionRatio: 0.7,
  randomizationScope: 'INTERVIEW', // INTERVIEW | CANDIDATE | TEMPLATE
  allowLlmFill: true,
  minCoreQuestions: 4,
});

export const DEFAULT_PRACTICE_QUESTION_STRATEGY = Object.freeze({
  enabled: false,
  mode: 'LLM_ONLY',
  enforceCoreQuestions: false,
  coreQuestionRatio: 0.5,
  randomizationScope: 'INTERVIEW',
  allowLlmFill: true,
  minCoreQuestions: 2,
});

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '');

const normalizeMode = (value, fallback = 'PRACTICE') => {
  const normalized = normalizeString(value).toUpperCase();
  if (STRUCTURED_TEMPLATE_MODES.has(normalized)) return normalized;
  return fallback;
};

const normalizeArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item).toLowerCase())
      .filter(Boolean);
  }
  const single = normalizeString(value).toLowerCase();
  return single ? [single] : [];
};

const normalizeQuestionType = (value) => {
  const normalized = normalizeString(value).toUpperCase().replace(/\s+/g, '_');
  if (!normalized) return 'BEHAVIORAL';
  return QUESTION_TYPE_ALIASES[normalized] || QUESTION_TYPE_ALIASES[normalized.replace(/_/g, ' ')] || 'BEHAVIORAL';
};

const normalizeDifficulty = (value, fallback = 'MEDIUM') => {
  const normalized = normalizeString(value).toUpperCase();
  if (normalized in DIFFICULTY_ORDER) return normalized;
  return fallback;
};

const normalizeExperienceLevel = (value) => {
  const token = normalizeString(value).toLowerCase();
  if (!token) return 'mid';
  if (token.includes('junior') || token.includes('entry') || token.includes('intern')) return 'junior';
  if (token.includes('senior') || token.includes('lead') || token.includes('staff') || token.includes('principal')) {
    return 'senior';
  }
  return 'mid';
};

const normalizeIndustry = (value) => {
  const token = normalizeString(value).toLowerCase();
  return token || 'any';
};

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const inferJobFamilies = (jobRole) => {
  const role = normalizeString(jobRole).toLowerCase();
  const families = ['any'];

  if (!role) return families;

  if (/(data scientist|data analyst|ml engineer|machine learning|data engineer)/.test(role)) {
    families.push('data');
  }
  if (/(product manager|product owner|growth manager)/.test(role)) {
    families.push('product');
  }
  if (/(designer|ux|ui)/.test(role)) {
    families.push('design');
  }
  if (/(manager|lead|head|director|vp)/.test(role)) {
    families.push('leadership');
  }
  if (/(engineer|developer|backend|front ?end|full ?stack|software)/.test(role)) {
    families.push('software-engineering');
  }

  return unique(families);
};

const overlaps = (left = [], right = []) => left.some((item) => right.includes(item));

const clampInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const clampFloat = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const deterministicNumber = (seed) => {
  const hash = crypto.createHash('sha256').update(String(seed)).digest('hex').slice(0, 8);
  return Number.parseInt(hash, 16);
};

const sortByDeterministicSeed = (items = [], seed = '') => {
  return [...items].sort((left, right) => {
    const leftWeight = deterministicNumber(`${seed}:${left?.id || ''}`);
    const rightWeight = deterministicNumber(`${seed}:${right?.id || ''}`);
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;
    return String(left?.id || '').localeCompare(String(right?.id || ''));
  });
};

const normalizeQuestionStrategy = (config, mode = 'PRACTICE') => {
  const source = config && typeof config === 'object' ? config : {};
  const normalizedMode = normalizeMode(mode);
  const defaults = normalizedMode === 'HIRING'
    ? DEFAULT_HIRING_QUESTION_STRATEGY
    : DEFAULT_PRACTICE_QUESTION_STRATEGY;

  return {
    enabled: source.enabled ?? defaults.enabled,
    mode: typeof source.mode === 'string' && source.mode.trim() ? source.mode.trim().toUpperCase() : defaults.mode,
    templateId: typeof source.templateId === 'string' && source.templateId.trim() ? source.templateId.trim() : null,
    enforceCoreQuestions: source.enforceCoreQuestions ?? defaults.enforceCoreQuestions,
    coreQuestionRatio: clampFloat(source.coreQuestionRatio, defaults.coreQuestionRatio, 0.2, 1),
    randomizationScope: ['INTERVIEW', 'CANDIDATE', 'TEMPLATE'].includes(
      normalizeString(source.randomizationScope).toUpperCase(),
    )
      ? normalizeString(source.randomizationScope).toUpperCase()
      : defaults.randomizationScope,
    allowLlmFill: source.allowLlmFill ?? defaults.allowLlmFill,
    minCoreQuestions: clampInt(source.minCoreQuestions, defaults.minCoreQuestions, 1, 20),
  };
};

const buildContext = ({ interview, totalQuestions }) => {
  const mode = normalizeMode(interview?.mode);
  const requestedTypes = unique(
    (Array.isArray(interview?.interviewTypes) && interview.interviewTypes.length
      ? interview.interviewTypes
      : ['behavioral'])
      .map((item) => normalizeQuestionType(item)),
  );

  return {
    mode,
    interviewId: interview?.id || null,
    candidateId: interview?.candidateId || null,
    organizationId: interview?.organizationId || null,
    jobRole: normalizeString(interview?.jobRole) || 'General',
    jobFamilies: inferJobFamilies(interview?.jobRole),
    experienceLevel: normalizeExperienceLevel(interview?.experienceLevel),
    industry: normalizeIndustry(interview?.industry),
    interviewTypes: requestedTypes.length ? requestedTypes : ['BEHAVIORAL'],
    skillFocus: normalizeArray(interview?.skillFocus),
    difficulty: normalizeDifficulty(interview?.config?.advancedSettings?.difficulty || interview?.difficulty || 'MEDIUM'),
    totalQuestions: clampInt(totalQuestions, 10, 1, 50),
  };
};

const isDifficultyCompatible = (questionDifficulty, requestedDifficulty) => {
  const questionRank = DIFFICULTY_ORDER[normalizeDifficulty(questionDifficulty)] || 2;
  const requestedRank = DIFFICULTY_ORDER[normalizeDifficulty(requestedDifficulty)] || 2;
  return Math.abs(questionRank - requestedRank) <= 1;
};

const questionMatchScore = (question, context, expectedType) => {
  if (!question?.approved) return -Infinity;

  const qType = normalizeQuestionType(question.type);
  if (expectedType && qType !== expectedType) return -Infinity;
  if (!expectedType && !context.interviewTypes.includes(qType)) return -Infinity;

  let score = 0;

  score += qType === expectedType || (!expectedType && context.interviewTypes.includes(qType)) ? 35 : 0;

  const qFamilies = normalizeArray(question.jobFamilies);
  if (overlaps(qFamilies, context.jobFamilies)) {
    score += qFamilies.includes('any') ? 8 : 22;
  }

  const qExperience = normalizeArray(question.experienceLevels);
  if (qExperience.length === 0 || qExperience.includes(context.experienceLevel) || qExperience.includes('any')) {
    score += 10;
  }

  const qIndustry = normalizeArray(question.industries);
  if (qIndustry.length === 0 || qIndustry.includes(context.industry) || qIndustry.includes('any')) {
    score += 8;
  }

  if (isDifficultyCompatible(question.difficulty, context.difficulty)) {
    score += normalizeDifficulty(question.difficulty) === context.difficulty ? 12 : 6;
  }

  const qSkills = normalizeArray(question.skills);
  const skillOverlap = qSkills.filter((skill) => context.skillFocus.includes(skill)).length;
  score += Math.min(skillOverlap, 3) * 3;

  return score;
};

const scoreTemplate = (template, context) => {
  if (!template) return -Infinity;
  let score = 0;

  if (normalizeString(template.mode).toUpperCase() === context.mode) {
    score += 25;
  }

  const templateFamilies = normalizeArray(template.jobFamilies);
  if (overlaps(templateFamilies, context.jobFamilies)) {
    score += templateFamilies.includes('any') ? 8 : 20;
  }

  const templateExperience = normalizeArray(template.experienceLevels);
  if (templateExperience.includes(context.experienceLevel) || templateExperience.includes('any')) {
    score += 15;
  }

  const templateTypes = unique((template.interviewTypes || []).map((item) => normalizeQuestionType(item)));
  const typeOverlap = templateTypes.filter((item) => context.interviewTypes.includes(item)).length;
  score += typeOverlap * 8;

  return score;
};

const questionById = new Map(INTERVIEW_QUESTION_LIBRARY.map((question) => [question.id, question]));

const normalizeQuestionId = (value) => {
  const normalized = normalizeString(value);
  return normalized || null;
};

const normalizeQuestionIdArray = (value) => {
  if (!Array.isArray(value)) return [];
  return unique(
    value
      .map((entry) => normalizeQuestionId(entry))
      .filter((questionId) => questionId && questionById.has(questionId)),
  );
};

const normalizeTemplateInterviewTypes = (value) => {
  if (!Array.isArray(value)) return [];
  return unique(value.map((item) => normalizeQuestionType(item)));
};

const deriveInterviewTypesFromQuestionIds = (questionIds = []) =>
  unique(
    questionIds
      .map((questionId) => questionById.get(questionId))
      .filter(Boolean)
      .map((question) => normalizeQuestionType(question.type)),
  );

const extractQuestionIdsFromEntries = (entries = [], { onlyCore = null } = {}) => {
  if (!Array.isArray(entries)) return [];
  const collected = entries
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      if (onlyCore === true && entry.isCoreQuestion !== true) return null;
      if (onlyCore === false && entry.isCoreQuestion === true) return null;
      return normalizeQuestionId(
        entry.questionBankId
        || entry.questionId
        || entry.libraryQuestionId
        || entry.id,
      );
    })
    .filter((questionId) => questionId && questionById.has(questionId));
  return unique(collected);
};

export const normalizeStructuredQuestionSet = (value, { fallbackMode = 'PRACTICE' } = {}) => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const coreQuestionIds = normalizeQuestionIdArray(value.coreQuestionIds);
  const randomPoolIds = normalizeQuestionIdArray(value.randomPoolIds)
    .filter((questionId) => !coreQuestionIds.includes(questionId));

  const interviewTypes = normalizeTemplateInterviewTypes(value.interviewTypes);
  const derivedTypes = deriveInterviewTypesFromQuestionIds([...coreQuestionIds, ...randomPoolIds]);

  return {
    enabled: value.enabled !== false,
    mode: normalizeMode(value.mode, normalizeMode(fallbackMode)),
    jobFamilies: unique(normalizeArray(value.jobFamilies)),
    experienceLevels: unique(normalizeArray(value.experienceLevels)),
    interviewTypes: interviewTypes.length ? interviewTypes : derivedTypes,
    coreQuestionIds,
    randomPoolIds,
  };
};

export const normalizeOrganizationTemplateForPlanner = (template, { fallbackMode = 'PRACTICE' } = {}) => {
  if (!template || typeof template !== 'object') return null;
  const templateId = normalizeString(template.id);
  if (!templateId) return null;

  const explicitSet = normalizeStructuredQuestionSet(
    template.structuredQuestionSet || template?.config?.structuredQuestionSet,
    { fallbackMode: template.mode || fallbackMode },
  );

  const legacyQuestions = Array.isArray(template.questions) ? template.questions : [];
  const legacyCoreQuestionIds = extractQuestionIdsFromEntries(legacyQuestions, { onlyCore: true });
  const legacyRandomQuestionIds = extractQuestionIdsFromEntries(legacyQuestions, { onlyCore: false })
    .filter((questionId) => !legacyCoreQuestionIds.includes(questionId));

  const coreQuestionIds = explicitSet?.coreQuestionIds?.length
    ? explicitSet.coreQuestionIds
    : legacyCoreQuestionIds;
  const randomPoolIds = explicitSet?.randomPoolIds?.length
    ? explicitSet.randomPoolIds
    : legacyRandomQuestionIds;

  if (!coreQuestionIds.length && !randomPoolIds.length) {
    return null;
  }

  const explicitTypes = explicitSet?.interviewTypes?.length
    ? explicitSet.interviewTypes
    : normalizeTemplateInterviewTypes(template.interviewTypes || template?.config?.interviewTypes);
  const derivedTypes = deriveInterviewTypesFromQuestionIds([...coreQuestionIds, ...randomPoolIds]);

  return {
    id: templateId,
    name: normalizeString(template.name) || 'Organization Structured Template',
    mode: normalizeMode(explicitSet?.mode || template.mode, normalizeMode(fallbackMode)),
    jobFamilies: explicitSet?.jobFamilies?.length
      ? unique([...explicitSet.jobFamilies, 'any'])
      : inferJobFamilies(template.jobRole),
    experienceLevels: explicitSet?.experienceLevels?.length
      ? unique([...explicitSet.experienceLevels, 'any'])
      : unique([normalizeExperienceLevel(template.experienceLevel), 'any']),
    interviewTypes: explicitTypes.length ? explicitTypes : derivedTypes,
    coreQuestionIds,
    randomPoolIds,
    source: 'ORGANIZATION',
    organizationId: normalizeString(template.organizationId) || null,
    isPublic: Boolean(template.isPublic),
  };
};

const resolveTemplate = (context, strategy, templateOverrides = []) => {
  if (strategy.templateId) {
    const explicitOverride = templateOverrides.find((template) => template.id === strategy.templateId);
    if (explicitOverride) return explicitOverride;
    const explicitCatalog = INTERVIEW_QUESTION_TEMPLATES.find((template) => template.id === strategy.templateId);
    if (explicitCatalog) return explicitCatalog;
  }

  const rankedTemplates = INTERVIEW_QUESTION_TEMPLATES
    .map((template) => ({ template, score: scoreTemplate(template, context) }))
    .filter((item) => Number.isFinite(item.score) && item.score > -Infinity)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.template.id.localeCompare(right.template.id);
    });

  return rankedTemplates[0]?.template || null;
};

const buildRubric = (questionType) => {
  const preset = RUBRIC_PRESETS[normalizeQuestionType(questionType)] || RUBRIC_PRESETS.BEHAVIORAL;
  return {
    ...preset,
    dimensions: preset.dimensions.map((dimension) => ({ ...dimension })),
  };
};

const toQuestionDocument = ({
  question,
  templateId,
  sequence,
  isCoreQuestion,
  questionSource = 'TEMPLATE_LIBRARY',
}) => ({
  id: `q_${sequence}_${question.id}`,
  sequence,
  question: question.prompt,
  type: normalizeQuestionType(question.type),
  difficulty: normalizeDifficulty(question.difficulty),
  expectedDuration: question.expectedDuration || 3,
  evaluationCriteria: Array.isArray(question.evaluationCriteria) ? question.evaluationCriteria : [],
  competencies: Array.isArray(question.competencies) ? question.competencies : [],
  rubric: buildRubric(question.type),
  questionSource,
  questionBankId: question.id,
  questionTemplateId: templateId,
  approvedQuestion: true,
  isCoreQuestion: Boolean(isCoreQuestion),
  questionLibraryVersion: QUESTION_LIBRARY_VERSION,
});

const buildScorecardBlueprint = (questions = []) => {
  const total = questions.length || 1;
  const dimensionMap = new Map();
  const competencyMap = new Map();

  questions.forEach((question) => {
    const dimensions = question?.rubric?.dimensions || [];
    dimensions.forEach((dimension) => {
      const existing = dimensionMap.get(dimension.key) || {
        key: dimension.key,
        label: dimension.label,
        weight: 0,
        questionCoverage: 0,
      };
      existing.weight += Number(dimension.weight) / total;
      existing.questionCoverage += 1;
      dimensionMap.set(dimension.key, existing);
    });

    (question.competencies || []).forEach((competency) => {
      competencyMap.set(competency, (competencyMap.get(competency) || 0) + 1);
    });
  });

  const dimensions = [...dimensionMap.values()].sort((left, right) => right.weight - left.weight);
  const competencies = [...competencyMap.entries()]
    .map(([name, count]) => ({ name, questionCoverage: count }))
    .sort((left, right) => right.questionCoverage - left.questionCoverage);

  return {
    scale: { min: 1, max: 5 },
    dimensions,
    competencies,
    totalQuestions: questions.length,
  };
};

const rankPool = ({ context, expectedType, excludedIds = new Set(), seed }) => {
  const scored = INTERVIEW_QUESTION_LIBRARY
    .filter((question) => !excludedIds.has(question.id))
    .map((question) => ({
      question,
      score: questionMatchScore(question, context, expectedType),
    }))
    .filter((item) => Number.isFinite(item.score) && item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const leftWeight = deterministicNumber(`${seed}:${left.question.id}`);
      const rightWeight = deterministicNumber(`${seed}:${right.question.id}`);
      return leftWeight - rightWeight;
    });

  return scored.map((item) => item.question);
};

const addUniqueQuestions = ({ target, candidates = [], maxCount, selectedIds }) => {
  for (const question of candidates) {
    if (target.length >= maxCount) break;
    if (!question?.id || selectedIds.has(question.id)) continue;
    selectedIds.add(question.id);
    target.push(question);
  }
};

const resolveRandomSeedScopeKey = (strategy, context, template) => {
  const scope = strategy.randomizationScope;
  if (scope === 'CANDIDATE') return context.candidateId || context.interviewId || template.id;
  if (scope === 'INTERVIEW') return context.interviewId || context.candidateId || template.id;
  return template.id;
};

export const buildStructuredInterviewQuestionPlan = ({ interview, totalQuestions, templateOverrides = [] }) => {
  const context = buildContext({ interview, totalQuestions });
  const strategyConfig = normalizeQuestionStrategy(interview?.config?.questionStrategy, context.mode);
  const normalizedTemplateOverrides = [];
  if (Array.isArray(templateOverrides)) {
    const seenTemplateIds = new Set();
    templateOverrides.forEach((template) => {
      if (!template || typeof template !== 'object') return;
      const templateId = normalizeString(template.id);
      if (!templateId || seenTemplateIds.has(templateId)) return;
      seenTemplateIds.add(templateId);
      normalizedTemplateOverrides.push(template);
    });
  }

  if (!strategyConfig.enabled || strategyConfig.mode === 'LLM_ONLY') {
    return {
      enabled: false,
      strategy: strategyConfig,
      questions: [],
      llmFillCount: context.totalQuestions,
      metadata: {
        reason: 'strategy-disabled',
      },
    };
  }

  const template = resolveTemplate(context, strategyConfig, normalizedTemplateOverrides);
  if (!template) {
    return {
      enabled: false,
      strategy: strategyConfig,
      questions: [],
      llmFillCount: context.totalQuestions,
      metadata: {
        reason: 'template-not-found',
      },
    };
  }

  const coreTarget = Math.min(
    context.totalQuestions,
    Math.max(
      strategyConfig.minCoreQuestions,
      Math.round(context.totalQuestions * strategyConfig.coreQuestionRatio),
    ),
  );

  const selectedIds = new Set();
  const coreQuestions = [];
  const randomQuestions = [];

  const requestedTypes = context.interviewTypes.length ? context.interviewTypes : ['BEHAVIORAL'];

  const templateCoreCandidates = (template.coreQuestionIds || [])
    .map((questionId) => questionById.get(questionId))
    .filter(Boolean)
    .filter((question) => requestedTypes.includes(normalizeQuestionType(question.type)));

  const perTypeMinimum = coreTarget >= requestedTypes.length ? 1 : 0;
  if (perTypeMinimum > 0) {
    requestedTypes.forEach((type) => {
      const byType = templateCoreCandidates.filter((question) => normalizeQuestionType(question.type) === type);
      if (byType.length === 0) return;
      const ordered = sortByDeterministicSeed(byType, `${template.id}:core:${type}`);
      addUniqueQuestions({
        target: coreQuestions,
        candidates: ordered.slice(0, 1),
        maxCount: coreTarget,
        selectedIds,
      });
    });
  }

  addUniqueQuestions({
    target: coreQuestions,
    candidates: sortByDeterministicSeed(templateCoreCandidates, `${template.id}:core`),
    maxCount: coreTarget,
    selectedIds,
  });

  if (coreQuestions.length < coreTarget) {
    const rankedFallbackCore = rankPool({
      context,
      expectedType: null,
      excludedIds: selectedIds,
      seed: `${template.id}:core-fallback`,
    });

    addUniqueQuestions({
      target: coreQuestions,
      candidates: rankedFallbackCore,
      maxCount: coreTarget,
      selectedIds,
    });
  }

  const randomTarget = Math.max(context.totalQuestions - coreQuestions.length, 0);

  const templateRandomCandidates = unique(template.randomPoolIds || [])
    .map((questionId) => questionById.get(questionId))
    .filter(Boolean)
    .filter((question) => requestedTypes.includes(normalizeQuestionType(question.type)))
    .filter((question) => !selectedIds.has(question.id));

  const randomSeedKey = resolveRandomSeedScopeKey(strategyConfig, context, template);
  addUniqueQuestions({
    target: randomQuestions,
    candidates: sortByDeterministicSeed(templateRandomCandidates, `${template.id}:random:${randomSeedKey}`),
    maxCount: randomTarget,
    selectedIds,
  });

  if (randomQuestions.length < randomTarget) {
    const rankedFallbackRandom = rankPool({
      context,
      expectedType: null,
      excludedIds: selectedIds,
      seed: `${template.id}:random-fallback:${randomSeedKey}`,
    });

    addUniqueQuestions({
      target: randomQuestions,
      candidates: sortByDeterministicSeed(rankedFallbackRandom, `${template.id}:random-shuffle:${randomSeedKey}`),
      maxCount: randomTarget,
      selectedIds,
    });
  }

  const selectedQuestions = [...coreQuestions, ...randomQuestions].slice(0, context.totalQuestions);
  const questionDocs = selectedQuestions.map((question, index) =>
    toQuestionDocument({
      question,
      templateId: template.id,
      sequence: index + 1,
      isCoreQuestion: index < coreQuestions.length,
    }),
  );

  const llmFillCount = Math.max(context.totalQuestions - questionDocs.length, 0);
  const scorecardBlueprint = buildScorecardBlueprint(questionDocs);

  return {
    enabled: true,
    strategy: strategyConfig,
    template: {
      id: template.id,
      name: template.name,
      mode: template.mode,
      source: template.source || 'CATALOG',
    },
    questions: questionDocs,
    coreQuestionCount: coreQuestions.length,
    randomizedQuestionCount: randomQuestions.length,
    llmFillCount,
    scorecardBlueprint,
    metadata: {
      libraryVersion: QUESTION_LIBRARY_VERSION,
      context,
    },
  };
};

const normalizeCatalogQuestionEntry = (question) => {
  if (!question || typeof question !== 'object') return null;
  const id = normalizeString(question.id);
  const prompt = normalizeString(question.prompt || question.question);
  if (!id || !prompt) return null;

  return {
    id,
    prompt,
    type: normalizeQuestionType(question.type),
    difficulty: normalizeDifficulty(question.difficulty),
    expectedDuration: clampInt(question.expectedDuration, 3, 1, 20),
    jobFamilies: unique(normalizeArray(question.jobFamilies).concat(['any'])),
    experienceLevels: unique(normalizeArray(question.experienceLevels).concat(['any'])),
    industries: unique(normalizeArray(question.industries).concat(['any'])),
    skills: unique(normalizeArray(question.skills)),
    competencies: Array.isArray(question.competencies) ? question.competencies : [],
    evaluationCriteria: Array.isArray(question.evaluationCriteria) ? question.evaluationCriteria : [],
    approved: question.approved !== false,
  };
};

const normalizeCatalogTemplateEntry = (template, questionMap, source = 'CATALOG') => {
  if (!template || typeof template !== 'object') return null;
  const id = normalizeString(template.id);
  if (!id) return null;

  const normalizeCatalogQuestionIds = (value) =>
    unique(
      (Array.isArray(value) ? value : [])
        .map((entry) => normalizeQuestionId(entry))
        .filter((questionId) => questionId && questionMap.has(questionId)),
    );

  const coreQuestionIds = normalizeCatalogQuestionIds(template.coreQuestionIds || [])
    .filter((questionId) => questionMap.has(questionId));
  const randomPoolIds = normalizeCatalogQuestionIds(template.randomPoolIds || [])
    .filter((questionId) => questionMap.has(questionId))
    .filter((questionId) => !coreQuestionIds.includes(questionId));
  const interviewTypes = normalizeTemplateInterviewTypes(template.interviewTypes);
  const derivedTypes = unique(
    [...coreQuestionIds, ...randomPoolIds]
      .map((questionId) => questionMap.get(questionId))
      .filter(Boolean)
      .map((question) => normalizeQuestionType(question.type)),
  );

  return {
    id,
    name: normalizeString(template.name) || 'Catalog Template',
    mode: normalizeMode(template.mode, 'PRACTICE'),
    source: template.source || source,
    organizationId: normalizeString(template.organizationId) || null,
    jobFamilies: unique(normalizeArray(template.jobFamilies).concat(['any'])),
    experienceLevels: unique(normalizeArray(template.experienceLevels).concat(['any'])),
    interviewTypes: interviewTypes.length ? interviewTypes : derivedTypes,
    coreQuestionIds,
    randomPoolIds,
  };
};

const rankPoolFromCatalog = ({
  questionLibrary,
  context,
  expectedType,
  excludedIds = new Set(),
  seed,
}) =>
  questionLibrary
    .filter((question) => !excludedIds.has(question.id))
    .map((question) => ({
      question,
      score: questionMatchScore(question, context, expectedType),
    }))
    .filter((item) => Number.isFinite(item.score) && item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const leftWeight = deterministicNumber(`${seed}:${left.question.id}`);
      const rightWeight = deterministicNumber(`${seed}:${right.question.id}`);
      return leftWeight - rightWeight;
    })
    .map((item) => item.question);

const resolveTemplateFromCandidates = (context, strategy, templates = []) => {
  if (!Array.isArray(templates) || templates.length === 0) return null;

  if (strategy.templateId) {
    const explicit = templates.find((template) => template.id === strategy.templateId);
    if (explicit) return explicit;
  }

  const ranked = templates
    .map((template) => ({ template, score: scoreTemplate(template, context) }))
    .filter((entry) => Number.isFinite(entry.score) && entry.score > -Infinity)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.template.id.localeCompare(right.template.id);
    });

  return ranked[0]?.template || null;
};

const buildStructuredInterviewQuestionPlanFromCatalog = ({
  interview,
  totalQuestions,
  templateOverrides = [],
  catalog,
}) => {
  const context = buildContext({ interview, totalQuestions });
  const strategyConfig = normalizeQuestionStrategy(interview?.config?.questionStrategy, context.mode);
  if (!strategyConfig.enabled || strategyConfig.mode === 'LLM_ONLY') {
    return {
      enabled: false,
      strategy: strategyConfig,
      questions: [],
      llmFillCount: context.totalQuestions,
      metadata: {
        reason: 'strategy-disabled',
      },
    };
  }

  const catalogQuestions = Array.isArray(catalog?.library?.questions) ? catalog.library.questions : [];
  const normalizedQuestions = catalogQuestions.map(normalizeCatalogQuestionEntry).filter(Boolean);
  if (!normalizedQuestions.length) {
    return buildStructuredInterviewQuestionPlan({ interview, totalQuestions, templateOverrides });
  }

  const questionMap = new Map(normalizedQuestions.map((question) => [question.id, question]));
  const catalogTemplates = Array.isArray(catalog?.templates)
    ? catalog.templates
      .map((template) => normalizeCatalogTemplateEntry(template, questionMap, template.source || 'CATALOG'))
      .filter(Boolean)
    : [];

  const normalizedOverrides = Array.isArray(templateOverrides)
    ? templateOverrides
      .map((template) => normalizeCatalogTemplateEntry(template, questionMap, template.source || 'ORGANIZATION'))
      .filter(Boolean)
    : [];

  const mergedTemplateMap = new Map();
  [...catalogTemplates, ...normalizedOverrides].forEach((template) => {
    if (!template?.id) return;
    mergedTemplateMap.set(template.id, template);
  });
  const templateCandidates = [...mergedTemplateMap.values()];

  const template = resolveTemplateFromCandidates(context, strategyConfig, templateCandidates);
  if (!template) {
    return {
      enabled: false,
      strategy: strategyConfig,
      questions: [],
      llmFillCount: context.totalQuestions,
      metadata: {
        reason: 'template-not-found',
      },
    };
  }

  const coreTarget = Math.min(
    context.totalQuestions,
    Math.max(
      strategyConfig.minCoreQuestions,
      Math.round(context.totalQuestions * strategyConfig.coreQuestionRatio),
    ),
  );

  const selectedIds = new Set();
  const coreQuestions = [];
  const randomQuestions = [];
  const requestedTypes = context.interviewTypes.length ? context.interviewTypes : ['BEHAVIORAL'];

  const templateCoreCandidates = (template.coreQuestionIds || [])
    .map((questionId) => questionMap.get(questionId))
    .filter(Boolean)
    .filter((question) => requestedTypes.includes(normalizeQuestionType(question.type)));

  const perTypeMinimum = coreTarget >= requestedTypes.length ? 1 : 0;
  if (perTypeMinimum > 0) {
    requestedTypes.forEach((type) => {
      const byType = templateCoreCandidates.filter((question) => normalizeQuestionType(question.type) === type);
      if (byType.length === 0) return;
      const ordered = sortByDeterministicSeed(byType, `${template.id}:core:${type}`);
      addUniqueQuestions({
        target: coreQuestions,
        candidates: ordered.slice(0, 1),
        maxCount: coreTarget,
        selectedIds,
      });
    });
  }

  addUniqueQuestions({
    target: coreQuestions,
    candidates: sortByDeterministicSeed(templateCoreCandidates, `${template.id}:core`),
    maxCount: coreTarget,
    selectedIds,
  });

  if (coreQuestions.length < coreTarget) {
    const fallbackCore = rankPoolFromCatalog({
      questionLibrary: normalizedQuestions,
      context,
      expectedType: null,
      excludedIds: selectedIds,
      seed: `${template.id}:core-fallback`,
    });
    addUniqueQuestions({
      target: coreQuestions,
      candidates: fallbackCore,
      maxCount: coreTarget,
      selectedIds,
    });
  }

  const randomTarget = Math.max(context.totalQuestions - coreQuestions.length, 0);
  const randomSeedKey = resolveRandomSeedScopeKey(strategyConfig, context, template);

  if (context.mode === 'PRACTICE') {
    const catalogWidePool = rankPoolFromCatalog({
      questionLibrary: normalizedQuestions,
      context,
      expectedType: null,
      excludedIds: selectedIds,
      seed: `${template.id}:practice-random:${randomSeedKey}`,
    });

    addUniqueQuestions({
      target: randomQuestions,
      candidates: sortByDeterministicSeed(catalogWidePool, `${template.id}:practice-random-shuffle:${randomSeedKey}`),
      maxCount: randomTarget,
      selectedIds,
    });
  } else {
    const templateRandomCandidates = unique(template.randomPoolIds || [])
      .map((questionId) => questionMap.get(questionId))
      .filter(Boolean)
      .filter((question) => requestedTypes.includes(normalizeQuestionType(question.type)))
      .filter((question) => !selectedIds.has(question.id));

    addUniqueQuestions({
      target: randomQuestions,
      candidates: sortByDeterministicSeed(templateRandomCandidates, `${template.id}:random:${randomSeedKey}`),
      maxCount: randomTarget,
      selectedIds,
    });
  }

  if (randomQuestions.length < randomTarget) {
    const fallbackRandom = rankPoolFromCatalog({
      questionLibrary: normalizedQuestions,
      context,
      expectedType: null,
      excludedIds: selectedIds,
      seed: `${template.id}:random-fallback:${randomSeedKey}`,
    });
    addUniqueQuestions({
      target: randomQuestions,
      candidates: sortByDeterministicSeed(fallbackRandom, `${template.id}:random-shuffle:${randomSeedKey}`),
      maxCount: randomTarget,
      selectedIds,
    });
  }

  const selectedQuestions = [...coreQuestions, ...randomQuestions].slice(0, context.totalQuestions);
  const questionSource = catalog?.source === 'FIRESTORE' ? 'QUESTION_CATALOG' : 'TEMPLATE_LIBRARY';
  const questionDocs = selectedQuestions.map((question, index) =>
    toQuestionDocument({
      question,
      templateId: template.id,
      sequence: index + 1,
      isCoreQuestion: index < coreQuestions.length,
      questionSource,
    }),
  );
  const matchedPoolSize = rankPoolFromCatalog({
    questionLibrary: normalizedQuestions,
    context,
    expectedType: null,
    excludedIds: new Set(),
    seed: `${template.id}:matched`,
  }).length;

  return {
    enabled: true,
    strategy: strategyConfig,
    template: {
      id: template.id,
      name: template.name,
      mode: template.mode,
      source: template.source || 'CATALOG',
    },
    questions: questionDocs,
    coreQuestionCount: coreQuestions.length,
    randomizedQuestionCount: randomQuestions.length,
    llmFillCount: Math.max(context.totalQuestions - questionDocs.length, 0),
    scorecardBlueprint: buildScorecardBlueprint(questionDocs),
    metadata: {
      libraryVersion: catalog?.library?.version || QUESTION_LIBRARY_VERSION,
      catalogVersion: catalog?.library?.version || QUESTION_LIBRARY_VERSION,
      context,
      catalogSource: catalog?.source || 'STATIC_FALLBACK',
      approvedPoolSize: normalizedQuestions.length,
      matchedPoolSize,
    },
  };
};

export const buildStructuredInterviewQuestionPlanAsync = async ({
  interview,
  totalQuestions,
  templateOverrides = [],
  catalog = null,
}) => {
  const runtimeCatalog = catalog || await getApprovedCatalog({ includeQuestions: true });
  const runtimeQuestions = Array.isArray(runtimeCatalog?.library?.questions) ? runtimeCatalog.library.questions : [];
  if (!runtimeQuestions.length) {
    return buildStructuredInterviewQuestionPlan({ interview, totalQuestions, templateOverrides });
  }

  return buildStructuredInterviewQuestionPlanFromCatalog({
    interview,
    totalQuestions,
    templateOverrides,
    catalog: runtimeCatalog,
  });
};

const normalizeCriterionKey = (value) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

export const computeRubricWeightedScore = ({ rubric, criterionScores }) => {
  if (!rubric || typeof rubric !== 'object' || !Array.isArray(rubric.dimensions)) {
    return null;
  }
  if (!Array.isArray(criterionScores) || criterionScores.length === 0) {
    return null;
  }

  const maxScale = Number(rubric.scale?.max) || 5;
  if (!Number.isFinite(maxScale) || maxScale <= 0) {
    return null;
  }

  const criterionMap = new Map();
  criterionScores.forEach((entry) => {
    const rawKey = entry?.key || entry?.criterion || entry?.dimension;
    const key = normalizeCriterionKey(rawKey);
    const score = Number(entry?.score);
    if (!key || !Number.isFinite(score)) return;
    criterionMap.set(key, Math.max(0, Math.min(maxScale, score)));
  });

  let weightedSum = 0;
  let usedWeight = 0;

  rubric.dimensions.forEach((dimension) => {
    const key = normalizeCriterionKey(dimension.key || dimension.label);
    const weight = Number(dimension.weight) || 0;
    if (weight <= 0) return;

    const directScore = criterionMap.get(key);
    const fallbackScore = directScore == null
      ? criterionMap.get(normalizeCriterionKey(dimension.label))
      : directScore;

    if (!Number.isFinite(fallbackScore)) return;

    weightedSum += (fallbackScore / maxScale) * weight;
    usedWeight += weight;
  });

  if (usedWeight <= 0) {
    return null;
  }

  const normalized = (weightedSum / usedWeight) * 10;
  return Math.round(normalized * 10) / 10;
};

export const reconcileQuestionScore = ({ llmScore, rubricScore }) => {
  const llm = Number(llmScore);
  const rubric = Number(rubricScore);
  const llmValid = Number.isFinite(llm);
  const rubricValid = Number.isFinite(rubric);

  if (llmValid && rubricValid) {
    return Math.round((rubric * 0.65 + llm * 0.35) * 10) / 10;
  }
  if (rubricValid) return Math.round(rubric * 10) / 10;
  if (llmValid) return Math.round(llm * 10) / 10;
  return null;
};

export const applyQuestionStrategyDefaults = (config, mode = 'PRACTICE') => {
  const safeConfig = config && typeof config === 'object' ? config : {};
  const strategy = normalizeQuestionStrategy(safeConfig.questionStrategy, normalizeMode(mode));

  return {
    ...safeConfig,
    questionStrategy: strategy,
  };
};

export const STRUCTURED_INTERVIEW_LIBRARY_INFO = Object.freeze({
  version: QUESTION_LIBRARY_VERSION,
  totalQuestions: INTERVIEW_QUESTION_LIBRARY.length,
  totalTemplates: INTERVIEW_QUESTION_TEMPLATES.length,
});

const toCatalogTemplateSummary = (template, source = 'CATALOG') => {
  const coreQuestionIds = normalizeQuestionIdArray(template.coreQuestionIds || []);
  const randomPoolIds = normalizeQuestionIdArray(template.randomPoolIds || [])
    .filter((questionId) => !coreQuestionIds.includes(questionId));
  const interviewTypes = normalizeTemplateInterviewTypes(template.interviewTypes);
  const derivedInterviewTypes = deriveInterviewTypesFromQuestionIds([...coreQuestionIds, ...randomPoolIds]);
  const coreQuestions = coreQuestionIds
    .map((id) => questionById.get(id))
    .filter(Boolean);
  const randomQuestions = randomPoolIds
    .map((id) => questionById.get(id))
    .filter(Boolean);

  const typeDistribution = [...coreQuestions, ...randomQuestions].reduce((acc, question) => {
    const type = normalizeQuestionType(question.type);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    id: template.id,
    name: template.name,
    mode: normalizeMode(template.mode, 'PRACTICE'),
    source,
    organizationId: template.organizationId || null,
    jobFamilies: unique(normalizeArray(template.jobFamilies).concat(['any'])),
    experienceLevels: unique(normalizeArray(template.experienceLevels).concat(['any'])),
    interviewTypes: interviewTypes.length ? interviewTypes : derivedInterviewTypes,
    coreQuestionIds,
    randomPoolIds,
    coreQuestionCount: coreQuestions.length,
    randomPoolCount: randomQuestions.length,
    totalPoolCount: coreQuestions.length + randomQuestions.length,
    typeDistribution,
  };
};

export const getStructuredInterviewCatalog = ({ templateOverrides = [], includeQuestions = false } = {}) => {
  const typeCounts = INTERVIEW_QUESTION_LIBRARY.reduce((acc, question) => {
    const type = normalizeQuestionType(question.type);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const catalogTemplates = INTERVIEW_QUESTION_TEMPLATES.map((template) => toCatalogTemplateSummary(template, 'CATALOG'));
  const organizationTemplates = Array.isArray(templateOverrides)
    ? templateOverrides
      .map((template) => {
        if (!template || typeof template !== 'object') return null;
        if (Array.isArray(template.coreQuestionIds) || Array.isArray(template.randomPoolIds)) {
          return {
            ...template,
            id: normalizeString(template.id),
          };
        }
        return normalizeOrganizationTemplateForPlanner(template, {
          fallbackMode: template.mode || 'PRACTICE',
        });
      })
      .filter((template) => template && template.id)
      .map((template) => toCatalogTemplateSummary(template, 'ORGANIZATION'))
    : [];

  const mergedById = new Map();
  [...catalogTemplates, ...organizationTemplates].forEach((template) => {
    mergedById.set(template.id, template);
  });
  const templates = [...mergedById.values()].sort((left, right) => left.id.localeCompare(right.id));

  return {
    library: {
      version: QUESTION_LIBRARY_VERSION,
      totalQuestions: INTERVIEW_QUESTION_LIBRARY.length,
      typeCounts,
      ...(includeQuestions
        ? {
            questions: INTERVIEW_QUESTION_LIBRARY.map((question) => ({
              id: question.id,
              prompt: question.prompt,
              type: normalizeQuestionType(question.type),
              difficulty: normalizeDifficulty(question.difficulty),
              expectedDuration: question.expectedDuration || 3,
              competencies: Array.isArray(question.competencies) ? question.competencies : [],
              evaluationCriteria: Array.isArray(question.evaluationCriteria) ? question.evaluationCriteria : [],
              jobFamilies: normalizeArray(question.jobFamilies),
              experienceLevels: normalizeArray(question.experienceLevels),
              industries: normalizeArray(question.industries),
              skills: normalizeArray(question.skills),
            })),
          }
        : {}),
    },
    templates,
  };
};
