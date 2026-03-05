import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const referralsData = new Map();
const referralSignupsData = new Map();
const referralHistoryData = new Map();

const toIsoNow = () => new Date().toISOString();

const applyFieldValue = (current, value) => {
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__increment')) {
    return Number(current || 0) + Number(value.__increment || 0);
  }
  return value;
};

const normalizeDocData = (target = {}, update = {}, { merge = false } = {}) => {
  const base = merge ? { ...target } : {};
  Object.entries(update || {}).forEach(([key, value]) => {
    base[key] = applyFieldValue(base[key], value);
  });
  return base;
};

const createDocRef = (store, docId) => ({
  id: docId,
  get: async () => ({
    id: docId,
    exists: store.has(docId),
    data: () => (store.has(docId) ? { ...store.get(docId) } : undefined),
    ref: createDocRef(store, docId),
  }),
  set: async (data, options = {}) => {
    const current = store.get(docId) || {};
    store.set(docId, normalizeDocData(current, data, { merge: options?.merge === true }));
  },
  update: async (data) => {
    const current = store.get(docId) || {};
    store.set(docId, normalizeDocData(current, data, { merge: true }));
  },
});

const createSnapshotDocs = (store, rows) =>
  rows.map(([id, data]) => ({
    id,
    data: () => ({ ...data }),
    ref: createDocRef(store, id),
  }));

const createCollectionRef = (name) => {
  const store = name === 'referrals'
    ? referralsData
    : name === 'referral_signups'
      ? referralSignupsData
      : referralHistoryData;

  const collection = {
    doc: (id) => {
      const resolvedId = id || `${name}-${store.size + 1}`;
      return createDocRef(store, resolvedId);
    },
    where: (field, operator, value) => {
      const predicates = [{ field, operator, value }];
      const query = {
        where: (nextField, nextOperator, nextValue) => {
          predicates.push({ field: nextField, operator: nextOperator, value: nextValue });
          return query;
        },
        limit: (maxRows) => ({
          get: async () => {
            const rows = Array.from(store.entries()).filter(([, row]) =>
              predicates.every((predicate) => {
                if (predicate.operator !== '==') return false;
                return row?.[predicate.field] === predicate.value;
              }));
            const sliced = rows.slice(0, maxRows);
            const docs = createSnapshotDocs(store, sliced);
            return {
              empty: docs.length === 0,
              docs,
            };
          },
        }),
        orderBy: () => ({
          limit: (maxRows) => ({
            get: async () => {
              const rows = Array.from(store.entries()).filter(([, row]) =>
                predicates.every((predicate) => {
                  if (predicate.operator !== '==') return false;
                  return row?.[predicate.field] === predicate.value;
                }));
              const docs = createSnapshotDocs(store, rows.slice(0, maxRows));
              return {
                empty: docs.length === 0,
                docs,
              };
            },
          }),
        }),
        get: async () => {
          const rows = Array.from(store.entries()).filter(([, row]) =>
            predicates.every((predicate) => {
              if (predicate.operator !== '==') return false;
              return row?.[predicate.field] === predicate.value;
            }));
          const docs = createSnapshotDocs(store, rows);
          return {
            empty: docs.length === 0,
            docs,
          };
        },
      };
      return query;
    },
    orderBy: () => ({
      limit: (maxRows) => ({
        get: async () => {
          const docs = createSnapshotDocs(store, Array.from(store.entries()).slice(0, maxRows));
          return {
            empty: docs.length === 0,
            docs,
          };
        },
      }),
    }),
  };

  return collection;
};

const mockDb = {
  collection: (name) => createCollectionRef(name),
  runTransaction: async (callback) => {
    const tx = {
      get: (docRef) => docRef.get(),
      set: (docRef, data, options = {}) => docRef.set(data, options),
      update: (docRef, data) => docRef.update(data),
    };
    return callback(tx);
  },
};

jest.unstable_mockModule('../../config/firebase.js', () => ({
  default: {
    firestore: {
      FieldValue: {
        increment: (value) => ({ __increment: value }),
      },
    },
  },
  firestore: mockDb,
}));

const { ReferralController } = await import('../referral.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('ReferralController flow + idempotency', () => {
  beforeEach(() => {
    referralsData.clear();
    referralSignupsData.clear();
    referralHistoryData.clear();

    referralsData.set('referrer-1', {
      userId: 'referrer-1',
      code: 'REFABC123',
      totalReferrals: 0,
      completedReferrals: 0,
      totalPoints: 0,
      tier: 'none',
      createdAt: toIsoNow(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('attributes referrals once per referee (idempotent)', async () => {
    const first = await ReferralController.attributeReferralInternal({
      refCode: 'REFABC123',
      newUserId: 'candidate-1',
      newUserEmail: 'candidate1@example.com',
    });

    const second = await ReferralController.attributeReferralInternal({
      refCode: 'REFABC123',
      newUserId: 'candidate-1',
      newUserEmail: 'candidate1@example.com',
    });

    expect(first.success).toBe(true);
    expect(first.referrerId).toBe('referrer-1');
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already attributed/i);

    const referrer = referralsData.get('referrer-1');
    expect(referrer.totalReferrals).toBe(1);
    expect(referrer.totalPoints).toBe(50);

    const signup = referralSignupsData.get('candidate-1');
    expect(signup).toEqual(expect.objectContaining({
      referrerId: 'referrer-1',
      refereeId: 'candidate-1',
      status: 'signed_up',
      pointsAwarded: 50,
    }));
  });

  it('awards first interview bonus only once (idempotent)', async () => {
    await ReferralController.attributeReferralInternal({
      refCode: 'REFABC123',
      newUserId: 'candidate-2',
      newUserEmail: 'candidate2@example.com',
    });

    const first = await ReferralController.onFirstInterviewInternal({ userId: 'candidate-2' });
    const second = await ReferralController.onFirstInterviewInternal({ userId: 'candidate-2' });

    expect(first.success).toBe(true);
    expect(first.referrerId).toBe('referrer-1');
    expect(second.success).toBe(false);
    expect(second.message).toMatch(/already awarded/i);

    const referrer = referralsData.get('referrer-1');
    expect(referrer.completedReferrals).toBe(1);
    expect(referrer.totalPoints).toBe(150);

    const signup = referralSignupsData.get('candidate-2');
    expect(signup.status).toBe('interview_completed');
    expect(signup.bonusPointsAwarded).toBe(100);
  });

  it('returns referral profile payload for candidate self-view', async () => {
    referralSignupsData.set('candidate-3', {
      referrerId: 'referrer-1',
      refereeId: 'candidate-3',
      refereeEmail: 'candidate3@example.com',
      status: 'signed_up',
      createdAt: toIsoNow(),
      pointsAwarded: 50,
    });

    const req = {
      user: { id: 'referrer-1' },
    };
    const res = createResponse();
    const next = jest.fn();

    await ReferralController.getMyReferral(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      referral: expect.objectContaining({
        userId: 'referrer-1',
        code: 'REFABC123',
      }),
      referred: expect.arrayContaining([
        expect.objectContaining({
          status: 'signed_up',
        }),
      ]),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
