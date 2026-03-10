import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ApplicationController } from '../application.controller.js';
import * as firebaseData from '../../services/firebaseData.service.js';

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const buildReviewerRequest = (overrides = {}) => ({
  params: {},
  query: {},
  user: {
    id: 'reviewer-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1' },
      membership: { role: 'REVIEWER' },
    },
  },
  ...overrides,
});

const buildApplication = (overrides = {}) => ({
  id: 'application-1',
  candidateId: 'candidate-1',
  jobId: 'job-1',
  organizationId: 'org-1',
  status: 'SCREENING',
  createdAt: '2026-03-01T09:00:00.000Z',
  submittedAt: '2026-03-01T09:00:00.000Z',
  ...overrides,
});

const buildCandidate = () => ({
  id: 'candidate-1',
  fullName: 'Aki Yapa',
  email: 'aki@example.com',
});

const buildJob = () => ({
  id: 'job-1',
  title: 'DevOps Engineer',
  department: 'Infrastructure',
  organizationId: 'org-1',
});

describe('ApplicationController read-only organization roles', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns organization applications for a reviewer organization member', async () => {
    const req = buildReviewerRequest();
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobApplicationStore, 'listByOrganization').mockResolvedValue([
      buildApplication({ interviewId: 'interview-1' }),
      buildApplication({ id: 'application-2', interviewId: 'interview-2', candidateId: 'candidate-2', jobId: 'job-2' }),
    ]);
    jest.spyOn(firebaseData.interviewStore, 'listByOrganization').mockResolvedValue([
      { id: 'interview-1', organizationId: 'org-1', candidateId: 'candidate-1', jobId: 'job-1', reviewerAssignments: ['reviewer-1'] },
      { id: 'interview-2', organizationId: 'org-1', candidateId: 'candidate-2', jobId: 'job-2', reviewerAssignments: ['reviewer-2'] },
    ]);
    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(
      new Map([['candidate-1', buildCandidate()]]),
    );
    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(buildJob());
    jest.spyOn(firebaseData.organizationStore, 'getById').mockResolvedValue({
      id: 'org-1',
      companyName: 'Cynectex',
    });

    await ApplicationController.getOrganizationApplications(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        total: 1,
        applications: [
          expect.objectContaining({
            id: 'application-1',
            organizationId: 'org-1',
            candidate: expect.objectContaining({
              fullName: 'Aki Yapa',
              email: 'aki@example.com',
            }),
            job: expect.objectContaining({
              id: 'job-1',
              title: 'DevOps Engineer',
            }),
          }),
        ],
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('does not expose structured offer details to reviewers', async () => {
    const req = buildReviewerRequest({
      params: { id: 'application-1' },
    });
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobApplicationStore, 'getById').mockResolvedValue(
      buildApplication({
        status: 'OFFER',
        interviewId: 'interview-1',
        offer: {
          title: 'DevOps Engineer Offer',
          compensationAmount: 450000,
          compensationCurrency: 'LKR',
          compensationPeriod: 'MONTHLY',
          startDate: '2026-04-01T00:00:00.000Z',
          expiresAt: '2026-04-15T12:00:00.000Z',
          status: 'PENDING',
        },
      }),
    );
    jest.spyOn(firebaseData.interviewStore, 'listByOrganization').mockResolvedValue([
      { id: 'interview-1', organizationId: 'org-1', candidateId: 'candidate-1', jobId: 'job-1', reviewerAssignments: ['reviewer-1'] },
    ]);
    jest.spyOn(firebaseData.interviewStore, 'getById').mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      reviewerAssignments: ['reviewer-1'],
    });
    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(buildJob());
    jest.spyOn(firebaseData.userStore, 'getSummary').mockResolvedValue(buildCandidate());
    jest.spyOn(firebaseData.organizationStore, 'getById').mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
    });

    await ApplicationController.getApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        status: 'OFFER',
        offer: null,
      }),
    }));
  });

  it('returns job-specific applications for a reviewer organization member', async () => {
    const req = buildReviewerRequest({
      params: { jobId: 'job-1' },
    });
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobStore, 'getById').mockResolvedValue(buildJob());
    jest.spyOn(firebaseData.jobApplicationStore, 'listByJob').mockResolvedValue([
      buildApplication({ interviewId: 'interview-1' }),
      buildApplication({ id: 'application-2', interviewId: 'interview-2', candidateId: 'candidate-2' }),
    ]);
    jest.spyOn(firebaseData.interviewStore, 'listByOrganization').mockResolvedValue([
      { id: 'interview-1', organizationId: 'org-1', candidateId: 'candidate-1', jobId: 'job-1', reviewerAssignments: ['reviewer-1'] },
      { id: 'interview-2', organizationId: 'org-1', candidateId: 'candidate-2', jobId: 'job-1', reviewerAssignments: ['reviewer-2'] },
    ]);
    jest.spyOn(firebaseData.userStore, 'getSummaries').mockResolvedValue(
      new Map([['candidate-1', buildCandidate()]]),
    );

    await ApplicationController.getJobApplications(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        applications: [
          expect.objectContaining({
            id: 'application-1',
            candidate: expect.objectContaining({
              fullName: 'Aki Yapa',
            }),
            job: expect.objectContaining({
              title: 'DevOps Engineer',
            }),
          }),
        ],
        job: expect.objectContaining({
          id: 'job-1',
          title: 'DevOps Engineer',
        }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects direct application access when the reviewer is not assigned to a related interview', async () => {
    const req = buildReviewerRequest({
      params: { id: 'application-2' },
    });
    const res = createResponse();
    const next = jest.fn();

    jest.spyOn(firebaseData.jobApplicationStore, 'getById').mockResolvedValue(
      buildApplication({ id: 'application-2', interviewId: 'interview-2', candidateId: 'candidate-2', jobId: 'job-2' }),
    );
    jest.spyOn(firebaseData.interviewStore, 'listByOrganization').mockResolvedValue([
      { id: 'interview-1', organizationId: 'org-1', candidateId: 'candidate-1', jobId: 'job-1', reviewerAssignments: ['reviewer-1'] },
    ]);

    await ApplicationController.getApplication(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
