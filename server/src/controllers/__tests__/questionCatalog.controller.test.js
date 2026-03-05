import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const getApprovedCatalog = jest.fn();
const listQuestionCatalogImports = jest.fn();
const listQuestionCatalogQuestions = jest.fn();
const listQuestionCatalogSources = jest.fn();
const updateQuestionCatalogReviewStatus = jest.fn();
const clearQuestionCatalogCache = jest.fn();
const importQuestionDataset = jest.fn();
const publishAdminRealtimeUpdate = jest.fn();

jest.unstable_mockModule('../../services/questionCatalog.service.js', () => ({
  clearQuestionCatalogCache,
  getApprovedCatalog,
  listQuestionCatalogImports,
  listQuestionCatalogQuestions,
  listQuestionCatalogSources,
  updateQuestionCatalogReviewStatus,
}));

jest.unstable_mockModule('../../services/questionCatalogImport.service.js', () => ({
  importQuestionDataset,
}));

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  publishAdminRealtimeUpdate,
}));

const { QuestionCatalogController } = await import('../questionCatalog.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('QuestionCatalogController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    listQuestionCatalogSources.mockReturnValue({
      version: '2026-03-v1',
      licenseAllowlist: ['Apache-2.0'],
      sources: [{ key: 'internal-library', sourceName: 'Internal' }],
    });
    listQuestionCatalogImports.mockResolvedValue([]);
    listQuestionCatalogQuestions.mockResolvedValue([]);
    updateQuestionCatalogReviewStatus.mockResolvedValue({
      questionIds: ['q1'],
      reviewStatus: 'APPROVED',
    });
    getApprovedCatalog.mockResolvedValue({
      source: 'FIRESTORE',
      metadata: { approvedPoolSize: 12 },
    });
    importQuestionDataset.mockResolvedValue({
      batchId: 'batch-1',
      importedQuestions: 10,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns source manifest metadata', async () => {
    const req = { query: {} };
    const res = createResponse();
    const next = jest.fn();

    await QuestionCatalogController.getSources(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      sources: expect.any(Array),
    }));
  });

  it('validates source key before import', async () => {
    const req = { body: {}, user: { id: 'admin-1' } };
    const res = createResponse();
    const next = jest.fn();

    await QuestionCatalogController.importSource(req, res, next);

    expect(importQuestionDataset).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'sourceKey is required',
    }));
  });

  it('imports dataset and publishes admin realtime event', async () => {
    const req = {
      body: {
        sourceKey: 'internal-library',
        dryRun: false,
        approve: true,
        batchLabel: 'qa-run',
      },
      user: { id: 'admin-7' },
    };
    const res = createResponse();
    const next = jest.fn();

    await QuestionCatalogController.importSource(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(importQuestionDataset).toHaveBeenCalledWith(expect.objectContaining({
      sourceKey: 'internal-library',
      dryRun: false,
      approve: true,
      batchLabel: 'qa-run',
      reviewerId: 'admin-7',
    }));
    expect(publishAdminRealtimeUpdate).toHaveBeenCalledWith('dataset-updated', expect.objectContaining({
      datasetType: 'question-catalog',
      action: 'imported',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns clear 4xx import payload when source fails validation', async () => {
    importQuestionDataset.mockRejectedValueOnce(Object.assign(
      new Error('Source license is not allowed: GPL-3.0'),
      {
        status: 400,
        code: 'QUESTION_CATALOG_IMPORT_LICENSE_NOT_ALLOWED',
      },
    ));

    const req = {
      body: { sourceKey: 'blocked-source' },
      user: { id: 'admin-7' },
    };
    const res = createResponse();
    const next = jest.fn();

    await QuestionCatalogController.importSource(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Source license is not allowed: GPL-3.0',
      code: 'QUESTION_CATALOG_IMPORT_LICENSE_NOT_ALLOWED',
    });
  });

  it('updates review status for selected question ids', async () => {
    const req = {
      params: { id: 'q-primary' },
      body: { reviewStatus: 'REJECTED', questionIds: ['q-primary', 'q-secondary'] },
      user: { id: 'admin-2' },
    };
    const res = createResponse();
    const next = jest.fn();

    updateQuestionCatalogReviewStatus.mockResolvedValueOnce({
      questionIds: ['q-primary', 'q-secondary'],
      reviewStatus: 'REJECTED',
    });

    await QuestionCatalogController.updateQuestionReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(updateQuestionCatalogReviewStatus).toHaveBeenCalledWith({
      questionIds: ['q-primary', 'q-secondary'],
      reviewStatus: 'REJECTED',
      reviewerId: 'admin-2',
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('refreshes catalog cache and returns source metadata', async () => {
    const req = {};
    const res = createResponse();
    const next = jest.fn();

    await QuestionCatalogController.refreshCache(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(clearQuestionCatalogCache).toHaveBeenCalled();
    expect(getApprovedCatalog).toHaveBeenCalledWith({ includeQuestions: false, forceRefresh: true });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      cacheRefreshed: true,
      source: 'FIRESTORE',
    }));
  });
});
