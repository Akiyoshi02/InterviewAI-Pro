import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ApplicationController } from '../application.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const buildRequest = (overrides = {}) => ({
  params: { jobId: 'job-1' },
  body: {},
  user: {
    id: 'candidate-1',
    email: null,
    profile: {
      resumeUrl: null,
    },
  },
  ...overrides,
});

const buildPublicJob = (overrides = {}) => ({
  id: 'job-1',
  organizationId: 'org-1',
  status: 'PUBLISHED',
  publishedAt: new Date(Date.now() - 60_000).toISOString(),
  postingDuration: 30,
  acceptingApplications: true,
  ...overrides,
});

describe('ApplicationController.submitApplication', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects submission when resume is missing from both request and candidate profile', async () => {
    const req = buildRequest();
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(buildPublicJob());
    const createWithDuplicateCheckSpy = jest
      .spyOn(firebaseData.jobApplicationStore, 'createWithDuplicateCheck')
      .mockResolvedValue(null);

    await ApplicationController.submitApplication(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Resume is required to submit an application',
    });
    expect(createWithDuplicateCheckSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects submission when a required application question is unanswered', async () => {
    const req = buildRequest({
      body: {
        resumeUrl: '/uploads/resumes/candidate.pdf',
        answers: [{ questionId: 'portfolio', answer: '   ' }],
      },
    });
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(
      buildPublicJob({
        applicationQuestions: [
          { id: 'portfolio', question: 'Portfolio URL', required: true },
        ],
      }),
    );
    const createWithDuplicateCheckSpy = jest
      .spyOn(firebaseData.jobApplicationStore, 'createWithDuplicateCheck')
      .mockResolvedValue(null);

    await ApplicationController.submitApplication(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Missing required answer for: Portfolio URL',
    });
    expect(createWithDuplicateCheckSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('passes candidate profile resume to createWithDuplicateCheck when payload resumeUrl is omitted', async () => {
    const req = buildRequest({
      body: {
        coverLetter: 'I am a strong fit for this role.',
      },
      user: {
        id: 'candidate-1',
        email: null,
        profile: {
          resumeUrl: '/uploads/resumes/profile-resume.pdf',
        },
      },
    });
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(buildPublicJob());
    jest.spyOn(firebaseData.organizationStore, 'getById').mockResolvedValue({
      id: 'org-1',
      name: 'E2E Organization',
      logo: null,
      website: null,
    });

    const createWithDuplicateCheckSpy = jest
      .spyOn(firebaseData.jobApplicationStore, 'createWithDuplicateCheck')
      .mockResolvedValue({
        id: 'application-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        organizationId: 'org-1',
      });
    const stopError = new Error('stop-after-create-check');
    jest.spyOn(firebaseData.activityLogStore, 'record').mockRejectedValue(stopError);

    await ApplicationController.submitApplication(req, res, next);

    expect(createWithDuplicateCheckSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        resumeUrl: '/uploads/resumes/profile-resume.pdf',
      }),
    );
    expect(next).toHaveBeenCalledWith(stopError);
  });
});
