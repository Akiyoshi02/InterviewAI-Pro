import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AdminController } from '../admin.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';
import { firestore } from '../../config/firebase.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('AdminController structured interview governance', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns governance usage metrics with template breakdown', async () => {
    jest.spyOn(firestore, 'collection').mockImplementation((name) => {
      if (name === 'interviewTemplates') {
        return {
          limit: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ docs: [] }),
          }),
        };
      }
      return {
        limit: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ docs: [] }) }),
      };
    });

    jest.spyOn(firebaseData.systemSettingsStore, 'get').mockResolvedValue({
      structuredInterviewDefaults: {
        hiring: { enabled: true, mode: 'HYBRID_TEMPLATE' },
        practice: { enabled: false, mode: 'LLM_ONLY' },
      },
    });

    jest.spyOn(firebaseData.interviewStore, 'listRecent').mockResolvedValue([
      {
        id: 'int-1',
        mode: 'HIRING',
        status: 'COMPLETED',
        questionPlan: {
          enabled: true,
          templateId: 'hiring-software-engineer-mid-v1',
          templateName: 'Hiring - Software Engineer (Mid)',
          llmFillCount: 1,
        },
        overallScore: 78,
      },
      {
        id: 'int-2',
        mode: 'HIRING',
        status: 'IN_PROGRESS',
        questionPlan: {
          enabled: true,
          templateId: 'hiring-software-engineer-mid-v1',
          templateName: 'Hiring - Software Engineer (Mid)',
          llmFillCount: 0,
        },
        pendingEvaluation: true,
      },
      {
        id: 'int-3',
        mode: 'PRACTICE',
        status: 'COMPLETED',
      },
    ]);

    const req = { query: { limit: '200' } };
    const res = createResponse();
    const next = jest.fn();

    await AdminController.getStructuredInterviewGovernance(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));

    const payload = res.json.mock.calls[0][0];
    expect(payload.governance.usage.sampleSize).toBe(3);
    expect(payload.governance.usage.interviewsWithStructuredEnabled).toBe(2);
    expect(payload.governance.usage.templates[0]).toEqual(expect.objectContaining({
      templateId: 'hiring-software-engineer-mid-v1',
      interviews: 2,
      llmFillQuestions: 1,
    }));
  });

  it('previews structured question plan with defaults merged', async () => {
    jest.spyOn(firestore, 'collection').mockImplementation((name) => {
      if (name === 'interviewTemplates') {
        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({ exists: false }),
          }),
        };
      }
      return {
        doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }),
      };
    });

    jest.spyOn(firebaseData.systemSettingsStore, 'get').mockResolvedValue({
      structuredInterviewDefaults: {
        hiring: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          templateId: 'hiring-software-engineer-mid-v1',
          coreQuestionRatio: 0.7,
          minCoreQuestions: 4,
          randomizationScope: 'INTERVIEW',
          allowLlmFill: true,
          enforceCoreQuestions: true,
        },
        practice: {
          enabled: false,
          mode: 'LLM_ONLY',
        },
      },
    });

    const req = {
      body: {
        mode: 'HIRING',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['behavioral', 'technical', 'system-design', 'coding'],
        skillFocus: ['api-design'],
        totalQuestions: 6,
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await AdminController.previewStructuredInterviewPlan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.preview.plan.enabled).toBe(true);
    expect(payload.preview.plan.questions.length).toBe(6);
    expect(payload.preview.plan.template.id).toBe('hiring-software-engineer-mid-v1');
  });

  it('previews organization template override when templateId points to org template', async () => {
    jest.spyOn(firestore, 'collection').mockImplementation((name) => {
      if (name === 'interviewTemplates') {
        return {
          doc: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                id: 'org-template-1',
                organizationId: 'org-1',
                isPublic: false,
                name: 'Org Template',
                structuredQuestionSet: {
                  mode: 'HIRING',
                  coreQuestionIds: ['beh_deadline_star', 'tech_api_design'],
                  randomPoolIds: ['beh_conflict_resolution', 'tech_testing_strategy'],
                },
              }),
            }),
          }),
        };
      }
      return {
        doc: jest.fn().mockReturnValue({ get: jest.fn().mockResolvedValue({ exists: false }) }),
      };
    });

    jest.spyOn(firebaseData.systemSettingsStore, 'get').mockResolvedValue({
      structuredInterviewDefaults: {
        hiring: {
          enabled: true,
          mode: 'HYBRID_TEMPLATE',
          allowLlmFill: false,
        },
      },
    });

    const req = {
      body: {
        mode: 'HIRING',
        jobRole: 'Software Engineer',
        experienceLevel: 'mid',
        interviewTypes: ['behavioral', 'technical'],
        totalQuestions: 4,
        questionStrategy: {
          templateId: 'org-template-1',
          minCoreQuestions: 2,
          coreQuestionRatio: 0.5,
          allowLlmFill: false,
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await AdminController.previewStructuredInterviewPlan(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.preview.plan.template.id).toBe('org-template-1');
    expect(payload.preview.plan.template.source).toBe('ORGANIZATION');
    expect(payload.preview.plan.questions.length).toBe(4);
  });
});
