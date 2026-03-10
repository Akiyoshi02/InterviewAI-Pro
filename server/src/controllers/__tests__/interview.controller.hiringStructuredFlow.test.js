import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';
import { LLMService } from '../../services/llm.service.js';
import admin, { firestore as firestoreDb } from '../../config/firebase.js';

const pastIso = () => new Date(Date.now() - 5 * 60 * 1000).toISOString();

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('InterviewController hiring structured flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses structured template questions for hiring interviews before any LLM fill', async () => {
    const baseInterview = {
      id: 'hiring-int-001',
      mode: 'HIRING',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: 'company-1',
      organizationId: 'org-1',
      scheduledFor: pastIso(),
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical', 'system-design', 'coding'],
      skillFocus: ['system-design', 'api-design'],
      duration: 18,
      recordingConsentGivenAt: '2026-02-21T00:00:00.000Z',
      config: {
        advancedSettings: {
          difficulty: 'medium',
        },
      },
    };

    jest.spyOn(firebaseData.interviewStore, 'getWithQuestions')
      .mockResolvedValueOnce({ ...baseInterview, questions: [] })
      .mockResolvedValueOnce({ ...baseInterview, questions: [] });

    const addQuestionsSpy = jest
      .spyOn(firebaseData.interviewStore, 'addQuestions')
      .mockResolvedValue(true);

    jest.spyOn(firebaseData.interviewStore, 'update').mockRejectedValue(new Error('stop-after-structured-check'));
    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(new Map());

    const generateSpy = jest
      .spyOn(LLMService, 'generateInterviewQuestions')
      .mockResolvedValue([]);

    const req = {
      params: { id: 'hiring-int-001' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(generateSpy).not.toHaveBeenCalled();
    expect(addQuestionsSpy).toHaveBeenCalledTimes(1);

    const generatedQuestions = addQuestionsSpy.mock.calls[0][1];
    expect(Array.isArray(generatedQuestions)).toBe(true);
    expect(generatedQuestions.length).toBe(6);
    expect(generatedQuestions.every((question) => question.questionSource === 'TEMPLATE_LIBRARY')).toBe(true);
    expect(generatedQuestions.some((question) => question.isCoreQuestion)).toBe(true);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-structured-check');
  });

  it('resolves organization template override when templateId belongs to organization', async () => {
    const baseInterview = {
      id: 'hiring-int-org-template',
      mode: 'HIRING',
      status: 'SCHEDULED',
      candidateId: 'candidate-2',
      companyId: 'company-1',
      organizationId: 'org-1',
      scheduledFor: pastIso(),
      jobRole: 'Software Engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical'],
      skillFocus: ['testing'],
      duration: 12,
      recordingConsentGivenAt: '2026-02-22T00:00:00.000Z',
      config: {
        advancedSettings: {
          difficulty: 'medium',
        },
        questionStrategy: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          templateId: 'org-template-1',
          coreQuestionRatio: 0.5,
          minCoreQuestions: 2,
          allowLlmFill: false,
        },
      },
    };

    jest.spyOn(firebaseData.interviewStore, 'getWithQuestions')
      .mockResolvedValueOnce({ ...baseInterview, questions: [] })
      .mockResolvedValueOnce({ ...baseInterview, questions: [] });

    const addQuestionsSpy = jest
      .spyOn(firebaseData.interviewStore, 'addQuestions')
      .mockResolvedValue(true);

    jest.spyOn(firebaseData.interviewStore, 'update').mockRejectedValue(new Error('stop-after-org-template-check'));
    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(new Map());

    jest.spyOn(LLMService, 'generateInterviewQuestions').mockResolvedValue([]);

    const getTemplateSpy = jest.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        id: 'org-template-1',
        organizationId: 'org-1',
        isPublic: false,
        name: 'Org Template',
        interviewTypes: ['behavioral', 'technical'],
        structuredQuestionSet: {
          mode: 'HIRING',
          coreQuestionIds: ['beh_deadline_star', 'tech_api_design'],
          randomPoolIds: ['beh_conflict_resolution', 'tech_testing_strategy'],
        },
      }),
    });

    const collectionMock = {
      doc: jest.fn().mockReturnValue({ get: getTemplateSpy }),
    };
    jest.spyOn(admin, 'firestore').mockReturnValue({
      collection: jest.fn().mockReturnValue(collectionMock),
    });

    const req = {
      params: { id: 'hiring-int-org-template' },
      user: { id: 'candidate-2', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(getTemplateSpy).toHaveBeenCalledTimes(1);
    expect(addQuestionsSpy).toHaveBeenCalledTimes(1);

    const generatedQuestions = addQuestionsSpy.mock.calls[0][1];
    expect(generatedQuestions.length).toBe(4);
    expect(generatedQuestions.every((question) => question.questionTemplateId === 'org-template-1')).toBe(true);
    expect(generatedQuestions.some((question) => question.questionBankId === 'beh_deadline_star')).toBe(true);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-org-template-check');
  });

  it('persists practice structured question plan with catalog metadata fields', async () => {
    const baseInterview = {
      id: 'practice-int-001',
      mode: 'PRACTICE',
      status: 'SCHEDULED',
      candidateId: 'candidate-9',
      companyId: null,
      organizationId: null,
      jobRole: 'Software Engineer',
      experienceLevel: 'entry',
      industry: 'technology',
      interviewTypes: ['behavioral', 'technical'],
      skillFocus: ['communication'],
      duration: 12,
      recordingConsentGivenAt: '2026-03-03T00:00:00.000Z',
      config: {
        questionStrategy: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          templateId: 'practice-general-v1',
          enforceCoreQuestions: true,
          coreQuestionRatio: 0.6,
          minCoreQuestions: 3,
          allowLlmFill: true,
        },
        advancedSettings: {
          difficulty: 'medium',
        },
      },
    };

    jest.spyOn(firebaseData.interviewStore, 'getWithQuestions')
      .mockResolvedValueOnce({ ...baseInterview, questions: [] })
      .mockResolvedValueOnce({ ...baseInterview, questions: [] });

    const addQuestionsSpy = jest.spyOn(firebaseData.interviewStore, 'addQuestions').mockResolvedValue(true);
    const updateSpy = jest
      .spyOn(firebaseData.interviewStore, 'update')
      .mockRejectedValue(new Error('stop-after-practice-plan-check'));

    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(new Map());
    jest.spyOn(LLMService, 'generateInterviewQuestions').mockResolvedValue([]);
    jest.spyOn(firestoreDb, 'collection').mockImplementation(() => ({
      where: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        }),
      }),
      limit: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [] }),
      }),
    }));

    const req = {
      params: { id: 'practice-int-001' },
      user: { id: 'candidate-9', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(addQuestionsSpy).toHaveBeenCalledTimes(1);
    const generatedQuestions = addQuestionsSpy.mock.calls[0][1];
    expect(generatedQuestions.length).toBeGreaterThan(0);

    expect(updateSpy).toHaveBeenCalledTimes(1);
    const updatePayload = updateSpy.mock.calls[0][1];
    expect(updatePayload.questionPlan).toEqual(expect.objectContaining({
      enabled: true,
      catalogVersion: expect.any(String),
      catalogSource: expect.any(String),
      approvedPoolSize: expect.any(Number),
      matchedPoolSize: expect.any(Number),
    }));

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-practice-plan-check');
  });
});
