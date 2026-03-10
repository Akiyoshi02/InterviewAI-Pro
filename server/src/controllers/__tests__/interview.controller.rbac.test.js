import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { InterviewController } from '../interview.controller.js';
import {
  interviewStore,
  jobApplicationStore,
  jobStore,
  organizationStore,
  reviewStore,
  systemSettingsStore,
  userStore,
} from '../../services/firebaseData.service.js';
import { LLMService } from '../../services/llm.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

describe('InterviewController RBAC guards', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects reviewer role when creating hiring interviews', async () => {
    const req = {
      body: {
        mode: 'HIRING',
        candidateId: 'candidate-1',
      },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();
    const settingsSpy = jest.spyOn(systemSettingsStore, 'get');

    await InterviewController.createInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_ORG_PERMISSIONS',
    }));
    expect(settingsSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-approved organizations when creating hiring interviews', async () => {
    const req = {
      body: {
        mode: 'HIRING',
        candidateId: 'candidate-1',
      },
      user: {
        id: 'admin-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'PENDING' },
          membership: { role: 'ADMIN' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();
    const settingsSpy = jest.spyOn(systemSettingsStore, 'get');

    await InterviewController.createInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'ORG_APPROVAL_REQUIRED',
    }));
    expect(settingsSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-participant company members from starting interviews', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-1',
      status: 'SCHEDULED',
      organizationId: 'org-1',
      candidateId: 'candidate-user',
      companyId: 'recruiter-user',
      questions: [],
    });
    const generateQuestionsSpy = jest.spyOn(LLMService, 'generateInterviewQuestions').mockResolvedValue([]);
    const req = {
      params: { id: 'int-1' },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(generateQuestionsSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects non-participant company members from submitting answers', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-1',
      status: 'IN_PROGRESS',
      organizationId: 'org-1',
      candidateId: 'candidate-user',
      companyId: 'recruiter-user',
      questions: [{ id: 'q-1', question: 'Question?' }],
    });
    const updateQuestionSpy = jest.spyOn(interviewStore, 'updateQuestion').mockResolvedValue({});
    const req = {
      params: { id: 'int-1' },
      body: { questionId: 'q-1', answer: 'answer' },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.submitAnswer(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(updateQuestionSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('filters reviewer interview listings down to assigned interviews', async () => {
    jest.spyOn(interviewStore, 'listByOrganization').mockResolvedValue([
      {
        id: 'interview-assigned',
        organizationId: 'org-1',
        candidateId: 'candidate-1',
        reviewerAssignments: ['reviewer-user'],
      },
      {
        id: 'interview-unassigned',
        organizationId: 'org-1',
        candidateId: 'candidate-2',
        reviewerAssignments: ['reviewer-2'],
      },
    ]);
    jest.spyOn(userStore, 'getSummaries').mockResolvedValue(new Map());
    jest.spyOn(organizationStore, 'getById').mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
    });
    jest.spyOn(reviewStore, 'getByInterviewAndReviewer').mockResolvedValue(null);

    const req = {
      query: {},
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getCompanyInterviews(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      interviews: [expect.objectContaining({ id: 'interview-assigned' })],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects reviewer access to unassigned interview details', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      candidateId: 'candidate-user',
      companyId: 'recruiter-user',
      reviewerAssignments: ['reviewer-2'],
      questions: [],
    });

    const req = {
      params: { id: 'int-1' },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects reviewer users from uploading interview recordings', async () => {
    jest.spyOn(interviewStore, 'getById').mockResolvedValue({
      id: 'int-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      candidateId: 'candidate-user',
      companyId: 'recruiter-user',
      reviewerAssignments: ['reviewer-user'],
    });

    const req = {
      params: { id: 'int-1' },
      file: { path: 'uploads/recordings/file.webm' },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
      headers: {},
      get(name) {
        return this.headers[name] || null;
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.uploadRecording(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects reviewer users from running AI evaluation', async () => {
    jest.spyOn(interviewStore, 'getWithQuestions').mockResolvedValue({
      id: 'int-1',
      status: 'COMPLETED',
      organizationId: 'org-1',
      candidateId: 'candidate-user',
      companyId: 'recruiter-user',
      reviewerAssignments: ['reviewer-user'],
      questions: [],
    });

    const req = {
      params: { id: 'int-1' },
      user: {
        id: 'reviewer-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.runEvaluation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requires INTERVIEWING status before creating hiring interview from application flow', async () => {
    const req = {
      body: {
        mode: 'HIRING',
        candidateId: 'candidate-1',
        jobId: 'job-1',
      },
      user: {
        id: 'admin-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'ADMIN' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(systemSettingsStore, 'get').mockResolvedValue({ featureFlags: {} });
    jest.spyOn(userStore, 'getById').mockResolvedValue({
      id: 'candidate-1',
      accountType: 'CANDIDATE',
    });
    jest.spyOn(jobStore, 'getById').mockResolvedValue({
      id: 'job-1',
      organizationId: 'org-1',
    });
    jest.spyOn(jobApplicationStore, 'checkDuplicate').mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      status: 'SCREENING',
    });
    jest.spyOn(interviewStore, 'listByJob').mockResolvedValue([]);

    await InterviewController.createInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'APPLICATION_NOT_READY_FOR_INTERVIEW',
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults unscheduled hiring interview creation to PENDING status', async () => {
    const req = {
      body: {
        mode: 'HIRING',
        candidateId: 'candidate-1',
        jobId: 'job-1',
      },
      user: {
        id: 'admin-user',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'ADMIN' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(systemSettingsStore, 'get').mockResolvedValue({ featureFlags: {} });
    jest.spyOn(userStore, 'getById').mockResolvedValue({
      id: 'candidate-1',
      accountType: 'CANDIDATE',
    });
    jest.spyOn(jobStore, 'getById').mockResolvedValue({
      id: 'job-1',
      organizationId: 'org-1',
    });
    jest.spyOn(jobApplicationStore, 'checkDuplicate').mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      status: 'INTERVIEWING',
      statusHistory: [],
    });
    jest.spyOn(interviewStore, 'listByJob').mockResolvedValue([]);

    const stopError = new Error('stop-after-create');
    const createSpy = jest.spyOn(interviewStore, 'create').mockRejectedValue(stopError);

    await InterviewController.createInterview(req, res, next);

    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'HIRING',
      status: 'PENDING',
      scheduledFor: null,
      scheduleStatus: null,
    }));
    expect(next).toHaveBeenCalledWith(stopError);
  });
});
