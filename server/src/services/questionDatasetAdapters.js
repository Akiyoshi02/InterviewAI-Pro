import {
  INTERVIEW_QUESTION_LIBRARY,
  INTERVIEW_QUESTION_TEMPLATES,
  QUESTION_LIBRARY_VERSION,
} from '../data/interviewQuestionLibrary.js';

const CANONICAL_TYPES = new Set(['BEHAVIORAL', 'TECHNICAL', 'CODING', 'SYSTEM_DESIGN', 'CASE_STUDY']);
const CANONICAL_DIFFICULTIES = new Set(['EASY', 'MEDIUM', 'HARD']);

const TYPE_ALIASES = Object.freeze({
  behavioral: 'BEHAVIORAL',
  behaviour: 'BEHAVIORAL',
  behavioural: 'BEHAVIORAL',
  softskills: 'BEHAVIORAL',
  technical: 'TECHNICAL',
  tech: 'TECHNICAL',
  coding: 'CODING',
  code: 'CODING',
  algorithm: 'CODING',
  'system design': 'SYSTEM_DESIGN',
  system_design: 'SYSTEM_DESIGN',
  systemdesign: 'SYSTEM_DESIGN',
  architecture: 'SYSTEM_DESIGN',
  'case study': 'CASE_STUDY',
  case_study: 'CASE_STUDY',
  casestudy: 'CASE_STUDY',
});

const DIFFICULTY_ALIASES = Object.freeze({
  easy: 'EASY',
  beginner: 'EASY',
  basic: 'EASY',
  medium: 'MEDIUM',
  intermediate: 'MEDIUM',
  moderate: 'MEDIUM',
  hard: 'HARD',
  advanced: 'HARD',
  senior: 'HARD',
});

const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const toArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const normalizeQuestionType = (value) => {
  const token = normalizeToken(value);
  if (!token) return 'BEHAVIORAL';
  const mapped = TYPE_ALIASES[token] || TYPE_ALIASES[token.replace(/-/g, ' ')] || value;
  const canonical = String(mapped || '').trim().toUpperCase();
  if (CANONICAL_TYPES.has(canonical)) return canonical;
  return 'BEHAVIORAL';
};

export const normalizeDifficulty = (value) => {
  const token = normalizeToken(value);
  if (!token) return 'MEDIUM';
  const mapped = DIFFICULTY_ALIASES[token] || value;
  const canonical = String(mapped || '').trim().toUpperCase();
  if (CANONICAL_DIFFICULTIES.has(canonical)) return canonical;
  return 'MEDIUM';
};

const normalizeQuestionPrompt = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeQuestionEntry = (entry = {}, defaults = {}) => {
  const prompt = normalizeQuestionPrompt(entry.prompt || entry.question || entry.text || entry.title || '');
  if (!prompt) return null;

  return {
    prompt,
    type: normalizeQuestionType(entry.type || entry.category || defaults.type),
    difficulty: normalizeDifficulty(entry.difficulty || entry.level || defaults.difficulty),
    jobFamilies: toArray(entry.jobFamilies || entry.jobFamily || defaults.jobFamilies || ['any']).map((item) =>
      String(item).trim().toLowerCase(),
    ),
    experienceLevels: toArray(entry.experienceLevels || entry.experienceLevel || defaults.experienceLevels || ['any']).map((item) =>
      String(item).trim().toLowerCase(),
    ),
    industries: toArray(entry.industries || entry.industry || defaults.industries || ['any']).map((item) =>
      String(item).trim().toLowerCase(),
    ),
    skills: toArray(entry.skills || defaults.skills).map((item) => String(item).trim().toLowerCase()),
    competencies: toArray(entry.competencies || defaults.competencies).map((item) => String(item).trim()),
    evaluationCriteria: toArray(entry.evaluationCriteria || entry.criteria || defaults.evaluationCriteria).map((item) =>
      String(item).trim(),
    ),
    expectedDuration: Number.parseInt(entry.expectedDuration, 10) || defaults.expectedDuration || 3,
  };
};

const parseHuggingFaceRowsPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return [];
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows
    .map((row) => {
      const record = row?.row && typeof row.row === 'object' ? row.row : row;
      return normalizeQuestionEntry(record);
    })
    .filter(Boolean);
};

const parseGenericArrayPayload = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map((entry) => normalizeQuestionEntry(entry)).filter(Boolean);
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.questions)) {
      return payload.questions.map((entry) => normalizeQuestionEntry(entry)).filter(Boolean);
    }
    if (Array.isArray(payload.data)) {
      return payload.data.map((entry) => normalizeQuestionEntry(entry)).filter(Boolean);
    }
  }

  return [];
};

export const parseQuestionDatasetByAdapter = ({ adapter, payload, sourceKey }) => {
  if (adapter === 'internalLibrary') {
    return {
      questions: INTERVIEW_QUESTION_LIBRARY.map((entry) =>
        normalizeQuestionEntry({
          ...entry,
          prompt: entry.prompt,
        }),
      ).filter(Boolean),
      templates: INTERVIEW_QUESTION_TEMPLATES.map((template) => ({
        id: template.id,
        name: template.name,
        mode: String(template.mode || 'PRACTICE').toUpperCase(),
        jobFamilies: toArray(template.jobFamilies).map((item) => String(item).trim().toLowerCase()),
        experienceLevels: toArray(template.experienceLevels).map((item) => String(item).trim().toLowerCase()),
        interviewTypes: toArray(template.interviewTypes).map((item) => normalizeQuestionType(item)),
        coreQuestionIds: toArray(template.coreQuestionIds),
        randomPoolIds: toArray(template.randomPoolIds),
        source: 'INTERNAL',
      })),
      version: QUESTION_LIBRARY_VERSION,
    };
  }

  if (adapter === 'huggingFaceRows') {
    return {
      questions: parseHuggingFaceRowsPayload(payload),
      templates: [],
      version: `${sourceKey || 'external'}-v1`,
    };
  }

  if (adapter === 'genericJson') {
    return {
      questions: parseGenericArrayPayload(payload),
      templates: [],
      version: `${sourceKey || 'external'}-v1`,
    };
  }

  throw new Error(`Unsupported dataset adapter: ${adapter}`);
};

export const QUESTION_DATASET_ADAPTERS = Object.freeze({
  internalLibrary: 'internalLibrary',
  huggingFaceRows: 'huggingFaceRows',
  genericJson: 'genericJson',
});

