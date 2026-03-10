import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';
import { LLMService } from '../../services/llm.service.js';
import { firestore as firestoreDb } from '../../config/firebase.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const mockEmptyCatalogFirestore = () => jest.spyOn(firestoreDb, 'collection').mockImplementation(() => ({
  where: jest.fn().mockReturnValue({
    limit: jest.fn().mockReturnValue({
      get: jest.fn().mockResolvedValue({ docs: [] }),
    }),
  }),
  limit: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ docs: [] }),
  }),
  doc: jest.fn().mockReturnValue({
    get: jest.fn().mockResolvedValue({ exists: false }),
  }),
}));

describe('InterviewController practice start config flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('persists practice setup config (including prep notes) on interview creation', async () => {
    const createSpy = jest.spyOn(firebaseData.interviewStore, 'create').mockImplementation(async (payload) => {
      throw Object.assign(new Error('stop-after-create'), { payload });
    });
    jest.spyOn(firebaseData.systemSettingsStore, 'get').mockResolvedValue({
      defaultAIConfig: {
        model: 'qwen3:8b',
        temperature: 0.7,
        maxTokens: 2000,
      },
    });

    const req = {
      body: {
        mode: 'PRACTICE',
        jobRole: 'Backend Engineer',
        experienceLevel: 'Senior',
        industry: 'Fintech',
        interviewTypes: ['technical', 'behavioral'],
        skillFocus: ['system-design'],
        duration: 30,
        config: {
          personality: 'strategic-analytical',
          voice: 'alloy',
          interviewerName: 'Nora',
          prepNotes: 'Use STAR with metrics.',
          advancedSettings: {
            difficulty: 'hard',
            followUpQuestions: true,
          },
        },
      },
      user: {
        id: 'candidate-1',
        accountType: 'CANDIDATE',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.createInterview(req, res, next);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'PRACTICE',
      candidateId: 'candidate-1',
      config: expect.objectContaining({
        personality: 'strategic-analytical',
        voice: 'alloy',
        interviewerName: 'Nora',
        prepNotes: 'Use STAR with metrics.',
        advancedSettings: expect.objectContaining({
          difficulty: 'hard',
          followUpQuestions: true,
        }),
      }),
    }));
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-create');
  });

  it('forwards setup job details into generateInterviewQuestions config', async () => {
    const baseInterview = {
      id: 'practice-int-001',
      mode: 'PRACTICE',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: null,
      organizationId: null,
      jobRole: 'software-engineer',
      experienceLevel: 'mid',
      industry: 'technology',
      interviewTypes: ['technical', 'behavioral'],
      skillFocus: ['system-design', 'coding'],
      duration: 45,
      recordingConsentGivenAt: '2026-02-21T00:00:00.000Z',
      config: {
        personality: 'strategic-analytical',
        interviewerName: 'Alex',
        advancedSettings: {
          difficulty: 'hard',
        },
      },
    };

    const generatedQuestions = [
      {
        id: 'q_1',
        type: 'technical',
        difficulty: 'hard',
        question: 'Explain eventual consistency trade-offs.',
        expectedDuration: 3,
        evaluationCriteria: ['consistency', 'availability'],
      },
    ];

    jest.spyOn(firebaseData.interviewStore, 'getWithQuestions')
      .mockResolvedValueOnce({ ...baseInterview, questions: [] })
      .mockResolvedValueOnce({ ...baseInterview, questions: generatedQuestions });
    jest.spyOn(firebaseData.interviewStore, 'addQuestions').mockResolvedValue(true);
    jest.spyOn(firebaseData.interviewStore, 'update').mockRejectedValue(new Error('stop-after-config-check'));
    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(new Map());
    const generateSpy = jest
      .spyOn(LLMService, 'generateInterviewQuestions')
      .mockResolvedValue(generatedQuestions);
    mockEmptyCatalogFirestore();

    const req = {
      params: { id: 'practice-int-001' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(generateSpy).toHaveBeenCalledTimes(1);
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        jobRole: 'software-engineer',
        experienceLevel: 'mid',
        industry: 'technology',
        interviewTypes: ['technical', 'behavioral'],
        skillFocus: ['system-design', 'coding'],
        personality: 'strategic-analytical',
        difficulty: 'hard',
        interviewerName: 'Alex',
        totalQuestions: 15, // Math.floor(45 / 3)
      }),
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-config-check');
  });

  it('seeds prep notes into first generated question when interview starts', async () => {
    const baseInterview = {
      id: 'practice-int-002',
      mode: 'PRACTICE',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: null,
      organizationId: null,
      jobRole: 'backend-engineer',
      experienceLevel: 'senior',
      industry: 'fintech',
      interviewTypes: ['technical'],
      skillFocus: ['system-design'],
      duration: 15,
      recordingConsentGivenAt: '2026-03-03T01:00:00.000Z',
      config: {
        prepNotes: 'Remember STAR and quantify impact.',
        advancedSettings: {
          difficulty: 'medium',
        },
      },
    };
    const generatedQuestions = [
      {
        id: 'q_1',
        type: 'technical',
        difficulty: 'medium',
        question: 'Explain CAP theorem trade-offs.',
        expectedDuration: 3,
        evaluationCriteria: ['correctness'],
      },
    ];

    jest.spyOn(firebaseData.interviewStore, 'getWithQuestions')
      .mockResolvedValueOnce({ ...baseInterview, questions: [] })
      .mockResolvedValueOnce({ ...baseInterview, questions: generatedQuestions });
    jest.spyOn(firebaseData.interviewStore, 'addQuestions').mockResolvedValue(generatedQuestions);
    const updateQuestionSpy = jest.spyOn(firebaseData.interviewStore, 'updateQuestion').mockResolvedValue({
      ...generatedQuestions[0],
      prepNotes: 'Remember STAR and quantify impact.',
    });
    jest.spyOn(firebaseData.interviewStore, 'update').mockRejectedValue(new Error('stop-after-prep-seed'));
    jest.spyOn(LLMService, 'generateInterviewQuestions').mockResolvedValue(generatedQuestions);
    mockEmptyCatalogFirestore();

    const req = {
      params: { id: 'practice-int-002' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(updateQuestionSpy).toHaveBeenCalledWith(
      'practice-int-002',
      'q_1',
      { prepNotes: 'Remember STAR and quantify impact.' },
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('stop-after-prep-seed');
  });

  it('saves question notes by loading interview questions first', async () => {
    const getByIdSpy = jest.spyOn(firebaseData.interviewStore, 'getById');
    const getWithQuestionsSpy = jest.spyOn(firebaseData.interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'practice-int-003',
      mode: 'PRACTICE',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: null,
      organizationId: null,
      questions: [
        { id: 'q-1', question: 'Tell me about yourself.' },
      ],
    });
    const updateQuestionSpy = jest.spyOn(firebaseData.interviewStore, 'updateQuestion').mockResolvedValue({
      id: 'q-1',
      prepNotes: 'Start with current role.',
    });

    const req = {
      params: { id: 'practice-int-003', questionId: 'q-1' },
      body: { prepNotes: 'Start with current role.' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.saveQuestionNotes(req, res, next);

    expect(getWithQuestionsSpy).toHaveBeenCalledWith('practice-int-003');
    expect(getByIdSpy).not.toHaveBeenCalled();
    expect(updateQuestionSpy).toHaveBeenCalledWith('practice-int-003', 'q-1', {
      prepNotes: 'Start with current role.',
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });
});
