import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const stores = {
  questionCatalogQuestions: new Map(),
  questionCatalogTemplates: new Map(),
  questionCatalogImports: new Map(),
};

const getStore = (name) => {
  const store = stores[name];
  if (!store) {
    throw new Error(`Unknown collection: ${name}`);
  }
  return store;
};

const createDocRef = (collectionName, id) => {
  const store = getStore(collectionName);
  return {
    id,
    set: async (payload, options = {}) => {
      const current = store.get(id) || {};
      store.set(id, options.merge ? { ...current, ...payload } : { ...payload });
    },
    get: async () => ({
      exists: store.has(id),
      id,
      data: () => (store.has(id) ? { ...store.get(id) } : undefined),
    }),
  };
};

const applyPredicates = (rows, predicates) =>
  rows.filter(([, row]) =>
    predicates.every(({ field, operator, value }) => {
      if (operator !== '==') return false;
      return row?.[field] === value;
    }),
  );

const createQuery = (collectionName, predicates = [], sortField = null, sortDirection = 'asc') => {
  const store = getStore(collectionName);

  const queryApi = {
    where: (field, operator, value) => createQuery(
      collectionName,
      [...predicates, { field, operator, value }],
      sortField,
      sortDirection,
    ),
    orderBy: (field, direction = 'asc') => createQuery(
      collectionName,
      predicates,
      field,
      direction,
    ),
    limit: (count) => ({
      get: async () => {
        let rows = applyPredicates(Array.from(store.entries()), predicates);
        if (sortField) {
          rows = rows.sort((a, b) => {
            const left = a[1]?.[sortField];
            const right = b[1]?.[sortField];
            if (left === right) return 0;
            if (sortDirection === 'desc') return left > right ? -1 : 1;
            return left > right ? 1 : -1;
          });
        }
        const sliced = rows.slice(0, count);
        return {
          docs: sliced.map(([id, data]) => ({
            id,
            data: () => ({ ...data }),
          })),
        };
      },
    }),
    get: async () => {
      let rows = applyPredicates(Array.from(store.entries()), predicates);
      if (sortField) {
        rows = rows.sort((a, b) => {
          const left = a[1]?.[sortField];
          const right = b[1]?.[sortField];
          if (left === right) return 0;
          if (sortDirection === 'desc') return left > right ? -1 : 1;
          return left > right ? 1 : -1;
        });
      }
      return {
        docs: rows.map(([id, data]) => ({
          id,
          data: () => ({ ...data }),
        })),
      };
    },
  };

  return queryApi;
};

const firestoreMock = {
  collection: (name) => ({
    doc: (id) => createDocRef(name, id),
    where: (field, operator, value) => createQuery(name, [{ field, operator, value }]),
    orderBy: (field, direction = 'asc') => createQuery(name, [], field, direction),
    limit: (count) => createQuery(name).limit(count),
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

const questionCatalogService = await import('../questionCatalog.service.js');

describe('questionCatalog.service', () => {
  beforeEach(() => {
    Object.values(stores).forEach((store) => store.clear());
    questionCatalogService.clearQuestionCatalogCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('falls back to static catalog when Firestore catalog is empty', async () => {
    const catalog = await questionCatalogService.getApprovedCatalog({
      includeQuestions: true,
      forceRefresh: true,
    });

    expect(catalog.source).toBe('STATIC_FALLBACK');
    expect(catalog.library.questions.length).toBeGreaterThan(0);
    expect(catalog.templates.length).toBeGreaterThan(0);
  });

  it('returns Firestore catalog when approved questions and templates exist', async () => {
    stores.questionCatalogQuestions.set('q-1', {
      id: 'q-1',
      prompt: 'Describe a project where you handled unclear requirements.',
      type: 'BEHAVIORAL',
      difficulty: 'MEDIUM',
      approved: true,
      reviewStatus: 'APPROVED',
      source: 'EXTERNAL',
      version: 'catalog-v2',
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:00.000Z',
    });
    stores.questionCatalogQuestions.set('q-pending', {
      id: 'q-pending',
      prompt: 'This should not be served.',
      type: 'TECHNICAL',
      difficulty: 'MEDIUM',
      approved: false,
      reviewStatus: 'PENDING',
      version: 'catalog-v2',
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:00.000Z',
    });
    stores.questionCatalogTemplates.set('practice-general-v1', {
      id: 'practice-general-v1',
      name: 'Practice General',
      mode: 'PRACTICE',
      enabled: true,
      coreQuestionIds: ['q-1'],
      randomPoolIds: ['q-1'],
      createdAt: '2026-03-03T00:00:00.000Z',
      updatedAt: '2026-03-03T00:00:00.000Z',
    });

    const catalog = await questionCatalogService.getApprovedCatalog({
      includeQuestions: true,
      forceRefresh: true,
    });

    expect(catalog.source).toBe('FIRESTORE');
    expect(catalog.metadata.catalogVersion).toBe('catalog-v2');
    expect(catalog.library.questions).toHaveLength(1);
    expect(catalog.library.questions.some((question) => question.id === 'q-pending')).toBe(false);
    expect(catalog.templates).toHaveLength(1);
  });

  it('updates review status and approval flags in batch', async () => {
    stores.questionCatalogQuestions.set('q-review', {
      id: 'q-review',
      prompt: 'Explain how you validate API contracts.',
      type: 'TECHNICAL',
      approved: false,
      reviewStatus: 'PENDING',
      updatedAt: '2026-03-03T00:00:00.000Z',
    });

    const result = await questionCatalogService.updateQuestionCatalogReviewStatus({
      questionIds: ['q-review'],
      reviewStatus: 'APPROVED',
      reviewerId: 'admin-7',
    });

    expect(result.reviewStatus).toBe('APPROVED');

    const updated = stores.questionCatalogQuestions.get('q-review');
    expect(updated.approved).toBe(true);
    expect(updated.reviewStatus).toBe('APPROVED');
    expect(updated.reviewedBy).toBe('admin-7');
  });
});
