import crypto from 'crypto';
import { firestore } from '../config/firebase.js';
import {
  clearQuestionCatalogCache,
  getQuestionCatalogCollections,
  getQuestionDatasetManifest,
} from './questionCatalog.service.js';
import {
  normalizeDifficulty,
  normalizeQuestionType,
  parseQuestionDatasetByAdapter,
} from './questionDatasetAdapters.js';

const DEFAULT_BATCH_LABEL = 'manual-import';

const createImportError = (message, code = 'QUESTION_CATALOG_IMPORT_ERROR', status = 400) => {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
};

const sanitizeList = (value, { lowercase = false } = {}) => {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .map((entry) => (lowercase ? entry.toLowerCase() : entry)))];
};

const normalizePrompt = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim();

const buildQuestionId = (sourceKey, prompt, type) => {
  const digest = crypto
    .createHash('sha1')
    .update(`${sourceKey}:${type}:${prompt.toLowerCase()}`)
    .digest('hex')
    .slice(0, 16);
  return `qc_${sourceKey.replace(/[^a-z0-9]+/gi, '_')}_${digest}`;
};

const normalizeQuestion = (rawQuestion = {}, source = {}) => {
  const prompt = normalizePrompt(rawQuestion.prompt || rawQuestion.question || rawQuestion.text || '');
  if (!prompt || prompt.length < 10 || prompt.length > 500) return null;

  const type = normalizeQuestionType(rawQuestion.type || rawQuestion.category || 'BEHAVIORAL');
  const difficulty = normalizeDifficulty(rawQuestion.difficulty || rawQuestion.level || 'MEDIUM');
  const id = buildQuestionId(source.key || 'external', prompt, type);

  return {
    id,
    prompt,
    type,
    difficulty,
    expectedDuration: Number.parseInt(rawQuestion.expectedDuration, 10) || 3,
    jobFamilies: sanitizeList(rawQuestion.jobFamilies || ['any'], { lowercase: true }),
    experienceLevels: sanitizeList(rawQuestion.experienceLevels || ['any'], { lowercase: true }),
    industries: sanitizeList(rawQuestion.industries || ['any'], { lowercase: true }),
    skills: sanitizeList(rawQuestion.skills || [], { lowercase: true }),
    competencies: sanitizeList(rawQuestion.competencies || []),
    evaluationCriteria: sanitizeList(rawQuestion.evaluationCriteria || []),
  };
};

const dedupeQuestions = (questions = []) => {
  const seen = new Set();
  const deduped = [];
  for (const question of questions) {
    if (!question) continue;
    const key = `${question.type}:${question.prompt.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(question);
  }
  return deduped;
};

const parseResponsePayload = async (response) => {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  if (!text.trim()) return null;

  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
    return JSON.parse(text);
  }

  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return null;
  return lines.map((line) => JSON.parse(line));
};

const fetchSourcePayload = async (source) => {
  if (!source.downloadUrl) return null;
  const response = await fetch(source.downloadUrl);
  if (!response.ok) {
    throw createImportError(
      `Failed to download dataset: ${response.status} ${response.statusText}`,
      'QUESTION_CATALOG_IMPORT_DOWNLOAD_FAILED',
      400,
    );
  }
  try {
    return await parseResponsePayload(response);
  } catch (error) {
    throw createImportError(
      `Failed to parse source payload: ${error?.message || 'invalid response format'}`,
      'QUESTION_CATALOG_IMPORT_PARSE_FAILED',
      400,
    );
  }
};

const chunk = (array, size) => {
  const result = [];
  for (let index = 0; index < array.length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
};

export const importQuestionDataset = async ({
  sourceKey,
  dryRun = false,
  approve = false,
  batchLabel = DEFAULT_BATCH_LABEL,
  reviewerId = 'import-script',
} = {}) => {
  if (!sourceKey) {
    throw createImportError('sourceKey is required', 'QUESTION_CATALOG_IMPORT_SOURCE_REQUIRED', 400);
  }

  const manifest = getQuestionDatasetManifest();
  const collections = getQuestionCatalogCollections();
  const source = (manifest.sources || []).find((item) => item.key === sourceKey);
  if (!source) {
    throw createImportError(`Unknown source key: ${sourceKey}`, 'QUESTION_CATALOG_IMPORT_UNKNOWN_SOURCE', 400);
  }
  if (source.enabled === false) {
    throw createImportError(`Source is disabled: ${source.key}`, 'QUESTION_CATALOG_IMPORT_SOURCE_DISABLED', 400);
  }

  const isInternal = source.key === 'internal-library';
  const allowedLicenses = new Set(manifest.licenseAllowlist || []);
  if (!isInternal && !allowedLicenses.has(source.license)) {
    throw createImportError(
      `Source license is not allowed: ${source.license}`,
      'QUESTION_CATALOG_IMPORT_LICENSE_NOT_ALLOWED',
      400,
    );
  }

  const batchId = `import_${Date.now()}_${source.key.replace(/[^a-z0-9]+/gi, '_')}`;
  const startedAt = new Date().toISOString();
  const importRef = firestore.collection(collections.imports).doc(batchId);
  const importPayload = {
    id: batchId,
    sourceKey: source.key,
    sourceName: source.sourceName,
    sourceUrl: source.sourceUrl,
    license: source.license,
    licenseUrl: source.licenseUrl || null,
    adapter: source.adapter,
    status: dryRun ? 'DRY_RUN' : 'RUNNING',
    batchLabel: batchLabel || DEFAULT_BATCH_LABEL,
    approveOnImport: approve === true,
    dryRun: dryRun === true,
    createdAt: startedAt,
    updatedAt: startedAt,
    completedAt: null,
    stats: {
      parsedQuestions: 0,
      importedQuestions: 0,
      skippedQuestions: 0,
      templateCount: 0,
    },
  };

  if (!dryRun) {
    await importRef.set(importPayload);
  }

  try {
    const sourcePayload = source.adapter === 'internalLibrary'
      ? null
      : await fetchSourcePayload(source);
    let parsed;
    try {
      parsed = parseQuestionDatasetByAdapter({
        adapter: source.adapter,
        payload: sourcePayload,
        sourceKey: source.key,
      });
    } catch (error) {
      throw createImportError(
        `Unsupported source adapter or payload shape: ${error?.message || source.adapter}`,
        'QUESTION_CATALOG_IMPORT_UNSUPPORTED_ADAPTER',
        400,
      );
    }

    const normalizedQuestions = dedupeQuestions(
      (parsed.questions || [])
        .map((question) => normalizeQuestion(question, source))
        .filter(Boolean),
    );

    const reviewStatus = approve ? 'APPROVED' : 'PENDING';
    const approved = approve === true;
    const timestamp = new Date().toISOString();

    const questionDocuments = normalizedQuestions.map((question) => ({
      ...question,
      approved,
      reviewStatus,
      source: source.key === 'internal-library' ? 'INTERNAL' : 'EXTERNAL',
      sourceName: source.sourceName,
      sourceUrl: source.sourceUrl || null,
      license: source.license || null,
      licenseUrl: source.licenseUrl || null,
      importBatchId: batchId,
      version: parsed.version || manifest.version || 'external-v1',
      createdAt: timestamp,
      updatedAt: timestamp,
      reviewedAt: approved ? timestamp : null,
      reviewedBy: approved ? reviewerId : null,
    }));

    const templateDocuments = (parsed.templates || []).map((template) => ({
      id: template.id,
      name: template.name,
      mode: String(template.mode || 'PRACTICE').toUpperCase(),
      source: source.key === 'internal-library' ? 'INTERNAL' : 'EXTERNAL',
      jobFamilies: sanitizeList(template.jobFamilies || ['any'], { lowercase: true }),
      experienceLevels: sanitizeList(template.experienceLevels || ['any'], { lowercase: true }),
      interviewTypes: sanitizeList(template.interviewTypes || []).map(normalizeQuestionType),
      coreQuestionIds: sanitizeList(template.coreQuestionIds || []),
      randomPoolIds: sanitizeList(template.randomPoolIds || []).filter(
        (questionId) => !sanitizeList(template.coreQuestionIds || []).includes(questionId),
      ),
      enabled: template.enabled !== false,
      importBatchId: batchId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    if (!dryRun) {
      const questionChunks = chunk(questionDocuments, 400);
      for (const items of questionChunks) {
        const batch = firestore.batch();
        items.forEach((question) => {
          const ref = firestore.collection(collections.questions).doc(question.id);
          batch.set(ref, question, { merge: true });
        });
        await batch.commit();
      }

      if (source.seedTemplates && templateDocuments.length > 0) {
        const templateChunks = chunk(templateDocuments, 400);
        for (const items of templateChunks) {
          const batch = firestore.batch();
          items.forEach((template) => {
            const ref = firestore.collection(collections.templates).doc(template.id);
            batch.set(ref, template, { merge: true });
          });
          await batch.commit();
        }
      }

      await importRef.set(
        {
          status: 'COMPLETED',
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          stats: {
            parsedQuestions: normalizedQuestions.length,
            importedQuestions: questionDocuments.length,
            skippedQuestions: 0,
            templateCount: source.seedTemplates ? templateDocuments.length : 0,
          },
        },
        { merge: true },
      );
      clearQuestionCatalogCache();
    }

    return {
      success: true,
      source: source.key,
      dryRun,
      approve,
      batchId,
      parsedQuestions: normalizedQuestions.length,
      importedQuestions: questionDocuments.length,
      templatesPrepared: templateDocuments.length,
    };
  } catch (error) {
    if (!dryRun) {
      await importRef.set(
        {
          status: 'FAILED',
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          error: {
            code: error?.code || 'QUESTION_CATALOG_IMPORT_FAILED',
            message: error?.message || 'Import failed',
          },
        },
        { merge: true },
      );
    }
    throw error;
  }
};
