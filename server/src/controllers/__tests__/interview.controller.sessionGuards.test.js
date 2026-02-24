import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import { interviewStore } from '../../services/firebaseData.service.js';
import { LLMService } from '../../services/llm.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('InterviewController session guards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('requires recording consent before starting an interview', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-guard-1',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: null,
      organizationId: null,
      questions: [],
      recordingConsentGivenAt: null,
    });
    const generateSpy = jest.spyOn(LLMService, 'generateInterviewQuestions').mockResolvedValue([]);

    const req = {
      params: { id: 'int-guard-1' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'RECORDING_CONSENT_REQUIRED',
    }));
    expect(generateSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects endInterview when interview is not in progress', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-guard-2',
      status: 'SCHEDULED',
      candidateId: 'candidate-1',
      companyId: null,
      organizationId: null,
      questions: [],
    });
    const summarySpy = jest.spyOn(LLMService, 'generateInterviewSummary').mockResolvedValue({});

    const req = {
      params: { id: 'int-guard-2' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.endInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERVIEW_NOT_IN_PROGRESS',
    }));
    expect(summarySpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
