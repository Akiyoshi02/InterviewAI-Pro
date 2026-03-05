import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const stores = {
  questionCatalogQuestions: new Map(),
  questionCatalogTemplates: new Map(),
  questionCatalogImports: new Map(),
};

const clearQuestionCatalogCache = jest.fn();
const getQuestionCatalogCollections = jest.fn(() => ({
  questions: 'questionCatalogQuestions',
  templates: 'questionCatalogTemplates',
  imports: 'questionCatalogImports',
}));
const getQuestionDatasetManifest = jest.fn();
const parseQuestionDatasetByAdapter = jest.fn();

const createDocRef = (collectionName, id) => {
  const store = stores[collectionName];
  return {
    id,
    set: async (payload, options = {}) => {
      const current = store.get(id) || {};
      store.set(id, options.merge ? { ...current, ...payload } : { ...payload });
    },
    get: async () => ({
      exists: store.has(id),
      id,
      data: () => store.get(id),
    }),
  };
};

const firestoreMock = {
  collection: (name) => ({
    doc: (id) => createDocRef(name, id),
  }),
  batch: () => {
    const operations = [];
    return {
      set: (ref, payload, options = {}) => operations.push({ ref, payload, options }),
      commit: async () => {
        await Promise.all(operations.map(({ ref, payload, options }) => ref.set(payload, options)));
      },
    };
  },
};

jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: firestoreMock,
}));

jest.unstable_mockModule('../questionCatalog.service.js', () => ({
  clearQuestionCatalogCache,
  getQuestionCatalogCollections,
  getQuestionDatasetManifest,
}));

jest.unstable_mockModule('../questionDatasetAdapters.js', () => ({
  normalizeDifficulty: (value) => String(value || 'MEDIUM').toUpperCase(),
  normalizeQuestionType: (value) => String(value || 'BEHAVIORAL').toUpperCase(),
  parseQuestionDatasetByAdapter,
}));

const { importQuestionDataset } = await import('../questionCatalogImport.service.js');

describe('questionCatalogImport.service', () => {
  beforeEach(() => {
    Object.values(stores).forEach((store) => store.clear());
    jest.clearAllMocks();
    getQuestionDatasetManifest.mockReturnValue({
      version: 'manifest-v1',
      licenseAllowlist: ['Apache-2.0', 'MIT'],
      sources: [
        {
          key: 'internal-library',
          sourceName: 'Internal',
          sourceUrl: 'internal://library',
          adapter: 'internalLibrary',
          enabled: true,
          seedTemplates: true,
          license: 'Proprietary-Internal',
        },
        {
          key: 'blocked-license-source',
          sourceName: 'Blocked Source',
          sourceUrl: 'https://example.com/blocked',
          downloadUrl: 'https://example.com/file.json',
          adapter: 'genericJson',
          enabled: true,
          seedTemplates: false,
          license: 'GPL-3.0',
        },
      ],
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects import when source license is not in allowlist', async () => {
    await expect(importQuestionDataset({
      sourceKey: 'blocked-license-source',
      dryRun: true,
    })).rejects.toMatchObject({
      message: expect.stringContaining('license is not allowed'),
      code: 'QUESTION_CATALOG_IMPORT_LICENSE_NOT_ALLOWED',
      status: 400,
    });
  });

  it('deduplicates normalized prompts on import and writes a single question', async () => {
    parseQuestionDatasetByAdapter.mockReturnValue({
      version: 'dataset-v2',
      questions: [
        {
          prompt: 'Tell me about a project where you improved reliability.',
          type: 'behavioral',
          difficulty: 'medium',
        },
        {
          prompt: ' Tell me about a project where you improved reliability. ',
          type: 'behavioral',
          difficulty: 'medium',
        },
      ],
      templates: [
        {
          id: 'practice-general-v1',
          name: 'Practice General',
          mode: 'PRACTICE',
          coreQuestionIds: [],
          randomPoolIds: [],
        },
      ],
    });

    const result = await importQuestionDataset({
      sourceKey: 'internal-library',
      dryRun: false,
      approve: false,
      batchLabel: 'qa-import',
      reviewerId: 'admin-1',
    });

    expect(result.importedQuestions).toBe(1);
    expect(stores.questionCatalogQuestions.size).toBe(1);
    const importedQuestion = Array.from(stores.questionCatalogQuestions.values())[0];
    expect(importedQuestion.reviewStatus).toBe('PENDING');
    expect(importedQuestion.approved).toBe(false);
    expect(stores.questionCatalogTemplates.size).toBe(1);
    expect(clearQuestionCatalogCache).toHaveBeenCalled();
  });
});

