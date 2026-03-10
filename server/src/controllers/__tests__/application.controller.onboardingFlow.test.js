import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockJobApplicationStore = {
  getById: jest.fn(),
  update: jest.fn(),
};
const mockJobStore = { getById: jest.fn() };
const mockInterviewStore = {};
const mockUserStore = { getSummary: jest.fn() };
const mockActivityLogStore = { record: jest.fn() };
const mockOrganizationStore = { getById: jest.fn() };
const mockOrganizationMemberStore = { listByOrganization: jest.fn() };
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  jobApplicationStore: mockJobApplicationStore,
  jobStore: mockJobStore,
  interviewStore: mockInterviewStore,
  userStore: mockUserStore,
  activityLogStore: mockActivityLogStore,
  organizationStore: mockOrganizationStore,
  organizationMemberStore: mockOrganizationMemberStore,
  isJobCurrentlyPublic: jest.fn(() => true),
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailNotifications: {
    sendApplicationOfferAcceptedCandidate: jest.fn(),
    sendApplicationOfferAcceptedHiringTeam: jest.fn(),
    sendApplicationOfferDeclinedCandidate: jest.fn(),
    sendApplicationOfferDeclinedHiringTeam: jest.fn(),
    sendApplicationOfferShared: jest.fn(),
    sendApplicationStatusUpdated: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

const { ApplicationController } = await import('../application.controller.js');
const { createApplicationOnboarding } = await import('../../utils/applicationOnboarding.util.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const baseApplication = {
  id: 'app-1',
  jobId: 'job-1',
  candidateId: 'candidate-1',
  organizationId: 'org-1',
  status: 'HIRED',
  jobSnapshot: { title: 'Data Analyst' },
  organizationSnapshot: { name: 'Cynectex' },
  offer: {
    title: 'Data Analyst Offer',
    compensationAmount: 450000,
    compensationCurrency: 'LKR',
    compensationPeriod: 'MONTHLY',
    startDate: '2026-04-01T00:00:00.000Z',
    expiresAt: '2099-04-15T12:00:00.000Z',
    status: 'ACCEPTED',
    createdAt: '2026-03-10T09:00:00.000Z',
    updatedAt: '2026-03-10T09:00:00.000Z',
    sentAt: '2026-03-10T09:00:00.000Z',
    acceptedAt: '2026-03-10T10:00:00.000Z',
  },
};

describe('ApplicationController onboarding flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Cynectex' });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Data Analyst' });
    mockUserStore.getSummary.mockImplementation(async (id) => ({
      id,
      fullName: id === 'candidate-1' ? 'Candidate One' : 'Recruiter One',
      email: `${id}@example.com`,
    }));
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates onboarding automatically when a candidate accepts an offer', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      ...baseApplication,
      status: 'OFFER',
      onboarding: null,
      offer: {
        ...baseApplication.offer,
        status: 'PENDING',
        acceptedAt: null,
        respondedAt: null,
      },
      statusHistory: [],
      offerHistory: [],
    });

    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      ...baseApplication,
      status: payload.status || 'HIRED',
      offer: payload.offer || baseApplication.offer,
      offerHistory: payload.offerHistory || [],
      statusHistory: payload.statusHistory || [],
      onboarding: payload.onboarding || null,
    }));

    const req = {
      params: { id: 'app-1' },
      user: { id: 'candidate-1', fullName: 'Candidate One', email: 'candidate@example.com' },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.acceptApplicationOffer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledTimes(2);
    expect(mockJobApplicationStore.update).toHaveBeenLastCalledWith(
      'app-1',
      expect.objectContaining({
        onboarding: expect.objectContaining({
          status: 'IN_PROGRESS',
          tasks: expect.any(Array),
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        status: 'HIRED',
        onboarding: expect.objectContaining({
          status: 'IN_PROGRESS',
        }),
      }),
    }));
  });

  it('lets the candidate submit an onboarding task', async () => {
    const onboarding = createApplicationOnboarding(baseApplication, { actorId: 'candidate-1', actorRole: 'CANDIDATE' });
    mockJobApplicationStore.getById.mockResolvedValue({
      ...baseApplication,
      onboarding,
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      ...baseApplication,
      onboarding: payload.onboarding,
    }));

    const req = {
      params: { id: 'app-1', taskId: 'candidate-share-documents' },
      body: { note: 'Shared my bank details with HR.' },
      user: { id: 'candidate-1' },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.submitApplicationOnboardingTask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        onboarding: expect.objectContaining({
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'candidate-share-documents',
              status: 'SUBMITTED',
              candidateNote: 'Shared my bank details with HR.',
            }),
          ]),
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Task submitted for hiring team review.',
    }));
  });

  it('lets recruiter approve a submitted candidate onboarding task', async () => {
    const onboarding = createApplicationOnboarding(baseApplication, { actorId: 'recruiter-1', actorRole: 'RECRUITER' });
    const submittedOnboarding = {
      ...onboarding,
      tasks: onboarding.tasks.map((task) => (
        task.id === 'candidate-share-documents'
          ? { ...task, status: 'SUBMITTED', candidateNote: 'Submitted payroll details.' }
          : task
      )),
    };
    mockJobApplicationStore.getById.mockResolvedValue({
      ...baseApplication,
      onboarding: submittedOnboarding,
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      ...baseApplication,
      onboarding: payload.onboarding,
    }));

    const req = {
      params: { id: 'app-1', taskId: 'candidate-share-documents' },
      body: { status: 'APPROVED', note: 'Verified and approved.' },
      user: {
        id: 'recruiter-1',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'RECRUITER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.reviewApplicationOnboardingTask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        onboarding: expect.objectContaining({
          tasks: expect.arrayContaining([
            expect.objectContaining({
              id: 'candidate-share-documents',
              status: 'APPROVED',
              reviewerNote: 'Verified and approved.',
            }),
          ]),
        }),
      }),
    );
  });

  it('rejects recruiter review actions for candidate acknowledgement tasks that are already complete', async () => {
    const onboarding = createApplicationOnboarding(baseApplication, { actorId: 'candidate-1', actorRole: 'CANDIDATE' });
    const completedAcknowledgement = {
      ...onboarding,
      tasks: onboarding.tasks.map((task) => (
        task.id === 'candidate-confirm-details'
          ? { ...task, status: 'COMPLETED', completedAt: '2026-03-10T10:00:00.000Z' }
          : task
      )),
    };

    mockJobApplicationStore.getById.mockResolvedValue({
      ...baseApplication,
      onboarding: completedAcknowledgement,
    });

    const req = {
      params: { id: 'app-1', taskId: 'candidate-confirm-details' },
      body: { status: 'APPROVED', note: 'Not applicable.' },
      user: {
        id: 'recruiter-1',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'RECRUITER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.reviewApplicationOnboardingTask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'This task does not support the requested update.',
    }));
  });
});
