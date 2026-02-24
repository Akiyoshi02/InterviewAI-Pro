import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';
import { LLMService } from '../../services/llm.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('InterviewController practice start config flow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
});
