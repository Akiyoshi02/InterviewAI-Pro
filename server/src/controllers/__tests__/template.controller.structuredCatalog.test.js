import { afterEach, describe, expect, it, jest } from '@jest/globals';
import admin from '../../config/firebase.js';
import { TemplateController } from '../template.controller.js';
import { activityLogStore } from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('TemplateController structured template support', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns structured catalog with organization templates merged', async () => {
    const getMock = jest.fn().mockResolvedValue({
      docs: [
        {
          data: () => ({
            id: 'org-template-1',
            name: 'Org Template',
            organizationId: 'org-1',
            interviewTypes: ['behavioral', 'technical'],
            structuredQuestionSet: {
              mode: 'HIRING',
              coreQuestionIds: ['beh_deadline_star'],
              randomPoolIds: ['beh_conflict_resolution'],
            },
          }),
        },
      ],
    });

    const collectionMock = {
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: getMock,
        }),
      }),
    };

    jest.spyOn(admin, 'firestore').mockReturnValue({
      collection: jest.fn().mockReturnValue(collectionMock),
    });

    const req = {
      user: {
        organizationContext: {
          organization: { id: 'org-1' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await TemplateController.getStructuredCatalog(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.catalog.library.questions.length).toBeGreaterThan(0);
    expect(payload.catalog.templates.some((template) => template.id === 'org-template-1')).toBe(true);
  });

  it('normalizes structuredQuestionSet before persisting templates', async () => {
    const setMock = jest.fn().mockResolvedValue(true);
    const docMock = {
      id: 'template-001',
      set: setMock,
    };

    const collectionMock = {
      doc: jest.fn().mockReturnValue(docMock),
    };

    jest.spyOn(admin, 'firestore').mockReturnValue({
      collection: jest.fn().mockReturnValue(collectionMock),
    });
    jest.spyOn(activityLogStore, 'record').mockResolvedValue(true);

    const req = {
      user: {
        id: 'user-1',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'ADMIN' },
        },
      },
      body: {
        name: 'Backend Hiring Template',
        jobRole: 'Backend Engineer',
        interviewTypes: ['behavioral', 'technical'],
        structuredQuestionSet: {
          mode: 'HIRING',
          coreQuestionIds: ['beh_deadline_star', 'unknown_question'],
          randomPoolIds: ['beh_deadline_star', 'beh_conflict_resolution'],
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await TemplateController.createTemplate(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(setMock).toHaveBeenCalledTimes(1);
    const storedTemplate = setMock.mock.calls[0][0];

    expect(storedTemplate.structuredQuestionSet.coreQuestionIds).toEqual(['beh_deadline_star']);
    expect(storedTemplate.structuredQuestionSet.randomPoolIds).toEqual(['beh_conflict_resolution']);
    expect(storedTemplate.config.structuredQuestionSet.coreQuestionIds).toEqual(['beh_deadline_star']);
    expect(storedTemplate.config.structuredQuestionSet.randomPoolIds).toEqual(['beh_conflict_resolution']);
  });
});
