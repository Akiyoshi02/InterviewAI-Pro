import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { firestore } from '../config/firebase.js';
import {
  INTERVIEW_QUESTION_LIBRARY,
  INTERVIEW_QUESTION_TEMPLATES,
  QUESTION_LIBRARY_VERSION,
} from '../data/interviewQuestionLibrary.js';

const QUESTION_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;
const COLLECTIONS = Object.freeze({
  questions: 'questionCatalogQuestions',
  templates: 'questionCatalogTemplates',
  imports: 'questionCatalogImports',
});

const MANIFEST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'questionDatasetSources.manifest.json',
);

let catalogCache = {
  expiresAt: 0,
  value: null,
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.status = 400;
  return error;
};

const normalizeArray = (value, { lowercase = false } = {}) => {
  if (!value) return [];
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => (lowercase ? entry.toLowerCase() : entry));
};

const normalizeQuestionType = (value) =>
  String(value || 'BEHAVIORAL')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const normalizeDifficulty = (value) => {
  const normalized = String(value || 'MEDIUM').trim().toUpperCase();
  if (normalized === 'EASY' || normalized === 'MEDIUM' || normalized === 'HARD') return normalized;
  return 'MEDIUM';
};

const loadDatasetSourceManifest = () => {
  const payload = readFileSync(MANIFEST_PATH, 'utf-8');
  const parsed = JSON.parse(payload);
  const sources = Array.isArray(parsed?.sources) ? parsed.sources : [];
  return {
    version: parsed?.version || 'unknown',
    licenseAllowlist: Array.isArray(parsed?.licenseAllowlist) ? parsed.licenseAllowlist : [],
    sources,
  };
};

const serializeQuestion = (question, { source = 'INTERNAL', reviewStatus = 'APPROVED', approved = true } = {}) => ({
  id: String(question.id || '').trim(),
  prompt: String(question.prompt || question.question || '').trim(),
  type: normalizeQuestionType(question.type),
  difficulty: normalizeDifficulty(question.difficulty),
  expectedDuration: Number.parseInt(question.expectedDuration, 10) || 3,
  jobFamilies: normalizeArray(question.jobFamilies || ['any'], { lowercase: true }),
  experienceLevels: normalizeArray(question.experienceLevels || ['any'], { lowercase: true }),
  industries: normalizeArray(question.industries || ['any'], { lowercase: true }),
  skills: normalizeArray(question.skills, { lowercase: true }),
  competencies: normalizeArray(question.competencies),
  evaluationCriteria: normalizeArray(question.evaluationCriteria),
  approved: Boolean(approved),
  reviewStatus: String(reviewStatus || (approved ? 'APPROVED' : 'PENDING')).toUpperCase(),
  source: String(source || 'INTERNAL').toUpperCase(),
  sourceName: String(question.sourceName || 'InterviewAI Internal Structured Library'),
  sourceUrl: question.sourceUrl || null,
  license: question.license || null,
  licenseUrl: question.licenseUrl || null,
  importBatchId: question.importBatchId || null,
  version: String(question.version || QUESTION_LIBRARY_VERSION),
  createdAt: question.createdAt || null,
  updatedAt: question.updatedAt || null,
  reviewedAt: question.reviewedAt || null,
  reviewedBy: question.reviewedBy || null,
});

const serializeTemplate = (template, { source = 'INTERNAL' } = {}) => ({
  id: String(template.id || '').trim(),
  name: String(template.name || '').trim(),
  mode: String(template.mode || 'PRACTICE').trim().toUpperCase(),
  source: String(template.source || source || 'INTERNAL').toUpperCase(),
  jobFamilies: normalizeArray(template.jobFamilies || ['any'], { lowercase: true }),
  experienceLevels: normalizeArray(template.experienceLevels || ['any'], { lowercase: true }),
  interviewTypes: normalizeArray(template.interviewTypes).map(normalizeQuestionType),
  coreQuestionIds: normalizeArray(template.coreQuestionIds),
  randomPoolIds: normalizeArray(template.randomPoolIds).filter(
    (questionId) => !normalizeArray(template.coreQuestionIds).includes(questionId),
  ),
  organizationId: template.organizationId || null,
  enabled: template.enabled !== false,
  createdAt: template.createdAt || null,
  updatedAt: template.updatedAt || null,
});

const buildLibrarySummary = (questions = [], includeQuestions = false) => {
  const typeCounts = questions.reduce((acc, question) => {
    const type = normalizeQuestionType(question.type);
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  return {
    version: QUESTION_LIBRARY_VERSION,
    totalQuestions: questions.length,
    typeCounts,
    ...(includeQuestions ? { questions } : {}),
  };
};

const buildFallbackCatalog = ({ includeQuestions = false } = {}) => {
  const questions = INTERVIEW_QUESTION_LIBRARY
    .filter((entry) => entry.approved !== false)
    .map((entry) => serializeQuestion(entry, { source: 'INTERNAL', reviewStatus: 'APPROVED', approved: true }));
  const templates = INTERVIEW_QUESTION_TEMPLATES.map((template) =>
    serializeTemplate(template, { source: 'INTERNAL' }),
  );

  return {
    source: 'STATIC_FALLBACK',
    loadedAt: new Date().toISOString(),
    cacheTtlMs: QUESTION_CATALOG_CACHE_TTL_MS,
    metadata: {
      approvedPoolSize: questions.length,
      templateCount: templates.length,
      matchedPoolSize: questions.length,
      catalogVersion: QUESTION_LIBRARY_VERSION,
    },
    library: buildLibrarySummary(questions, includeQuestions),
    templates,
  };
};

const normalizeQuestionDoc = (document) => {
  const source = typeof document?.data === 'function' ? document.data() : document;
  if (!source || typeof source !== 'object') return null;
  const id = String(source.id || document?.id || '').trim();
  const prompt = String(source.prompt || source.question || '').trim();
  if (!id || !prompt) return null;

  const reviewStatus = String(source.reviewStatus || '').toUpperCase();
  const approved = source.approved === true || reviewStatus === 'APPROVED';
  if (!approved) return null;

  return serializeQuestion(
    {
      ...source,
      id,
      prompt,
    },
    {
      source: source.source || 'EXTERNAL',
      reviewStatus: reviewStatus || 'APPROVED',
      approved: true,
    },
  );
};

const normalizeTemplateDoc = (document) => {
  const source = typeof document?.data === 'function' ? document.data() : document;
  if (!source || typeof source !== 'object') return null;
  const id = String(source.id || document?.id || '').trim();
  if (!id) return null;
  return serializeTemplate(
    {
      ...source,
      id,
    },
    {
      source: source.source || 'EXTERNAL',
    },
  );
};

const fetchFirestoreCatalog = async ({ includeQuestions = false } = {}) => {
  const [questionSnapshot, templateSnapshot] = await Promise.all([
    firestore.collection(COLLECTIONS.questions).where('approved', '==', true).limit(5000).get(),
    firestore.collection(COLLECTIONS.templates).limit(1000).get(),
  ]);

  const questions = questionSnapshot.docs.map(normalizeQuestionDoc).filter(Boolean);
  const templates = templateSnapshot.docs
    .map(normalizeTemplateDoc)
    .filter((template) => template && template.enabled !== false);

  if (!questions.length) {
    return null;
  }

  const resolvedTemplates = templates.length
    ? templates
    : INTERVIEW_QUESTION_TEMPLATES.map((template) =>
      serializeTemplate(template, { source: 'INTERNAL' }),
    );

  const catalogVersion = questionSnapshot.docs
    .map((doc) => doc.data()?.version)
    .filter(Boolean)
    .sort()
    .slice(-1)[0] || QUESTION_LIBRARY_VERSION;

  return {
    source: 'FIRESTORE',
    loadedAt: new Date().toISOString(),
    cacheTtlMs: QUESTION_CATALOG_CACHE_TTL_MS,
    metadata: {
      approvedPoolSize: questions.length,
      templateCount: resolvedTemplates.length,
      matchedPoolSize: questions.length,
      catalogVersion,
    },
    library: {
      ...buildLibrarySummary(questions, includeQuestions),
      version: catalogVersion,
    },
    templates: resolvedTemplates,
  };
};

const getCachedCatalog = ({ includeQuestions = false } = {}) => {
  if (!catalogCache.value || catalogCache.expiresAt <= Date.now()) return null;
  if (!includeQuestions) {
    return {
      ...catalogCache.value,
      library: {
        ...catalogCache.value.library,
        questions: undefined,
      },
    };
  }
  return catalogCache.value;
};

const setCatalogCache = (catalog) => {
  catalogCache = {
    value: catalog,
    expiresAt: Date.now() + QUESTION_CATALOG_CACHE_TTL_MS,
  };
};

export const clearQuestionCatalogCache = () => {
  catalogCache = { value: null, expiresAt: 0 };
};

export const getQuestionDatasetManifest = () => loadDatasetSourceManifest();

export const listQuestionCatalogSources = ({ includeDisabled = false } = {}) => {
  const manifest = loadDatasetSourceManifest();
  const filteredSources = (manifest.sources || []).filter((source) =>
    includeDisabled ? true : source.enabled !== false,
  );
  return {
    version: manifest.version,
    licenseAllowlist: manifest.licenseAllowlist,
    sources: filteredSources,
  };
};

export const getApprovedCatalog = async ({ includeQuestions = false, forceRefresh = false } = {}) => {
  if (!forceRefresh) {
    const cached = getCachedCatalog({ includeQuestions });
    if (cached) return cached;
  }

  let catalog = null;
  try {
    catalog = await fetchFirestoreCatalog({ includeQuestions: true });
  } catch {
    catalog = null;
  }

  if (!catalog) {
    catalog = buildFallbackCatalog({ includeQuestions: true });
  }

  setCatalogCache(catalog);

  if (!includeQuestions) {
    return {
      ...catalog,
      library: {
        ...catalog.library,
        questions: undefined,
      },
    };
  }

  return catalog;
};

export const listQuestionCatalogImports = async ({ limit = 50 } = {}) => {
  const snapshot = await firestore
    .collection(COLLECTIONS.imports)
    .orderBy('createdAt', 'desc')
    .limit(Math.max(1, Math.min(Number.parseInt(limit, 10) || 50, 500)))
    .get();
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
};

export const listQuestionCatalogQuestions = async ({
  reviewStatus = null,
  source = null,
  type = null,
  limit = 200,
} = {}) => {
  const snapshot = await firestore
    .collection(COLLECTIONS.questions)
    .orderBy('updatedAt', 'desc')
    .limit(Math.max(1, Math.min(Number.parseInt(limit, 10) || 200, 1000)))
    .get();

  return snapshot.docs
    .map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
    .filter((question) => {
      if (reviewStatus && String(question.reviewStatus || '').toUpperCase() !== String(reviewStatus).toUpperCase()) return false;
      if (source && String(question.source || '').toUpperCase() !== String(source).toUpperCase()) return false;
      if (type && normalizeQuestionType(question.type) !== normalizeQuestionType(type)) return false;
      return true;
    });
};

export const updateQuestionCatalogReviewStatus = async ({
  questionIds = [],
  reviewStatus,
  reviewerId,
}) => {
  const normalizedStatus = String(reviewStatus || '').toUpperCase();
  if (!['APPROVED', 'REJECTED', 'PENDING'].includes(normalizedStatus)) {
    throw createValidationError('Invalid review status');
  }

  const ids = normalizeArray(questionIds);
  if (!ids.length) {
    throw createValidationError('questionIds is required');
  }

  const batch = firestore.batch();
  const reviewedAt = new Date().toISOString();
  ids.forEach((questionId) => {
    const ref = firestore.collection(COLLECTIONS.questions).doc(questionId);
    batch.set(
      ref,
      {
        reviewStatus: normalizedStatus,
        approved: normalizedStatus === 'APPROVED',
        reviewedAt,
        reviewedBy: reviewerId || null,
        updatedAt: reviewedAt,
      },
      { merge: true },
    );
  });

  await batch.commit();
  clearQuestionCatalogCache();
  return {
    questionIds: ids,
    reviewStatus: normalizedStatus,
    reviewedAt,
  };
};

export const getQuestionCatalogCollections = () => ({ ...COLLECTIONS });
