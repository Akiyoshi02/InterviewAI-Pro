import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockJobApplicationStore = {
  getById: jest.fn(),
  update: jest.fn(),
};

const mockJobStore = {
  getById: jest.fn(),
};

const mockInterviewStore = {};

const mockUserStore = {
  getSummary: jest.fn(),
};

const mockActivityLogStore = {
  record: jest.fn(),
};

const mockOrganizationStore = {
  getById: jest.fn(),
};
const mockOrganizationMemberStore = {
  listByOrganization: jest.fn(),
};

const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();
const mockSendApplicationOfferShared = jest.fn();
const mockSendApplicationOfferAcceptedCandidate = jest.fn();
const mockSendApplicationOfferDeclinedCandidate = jest.fn();
const mockSendApplicationOfferAcceptedHiringTeam = jest.fn();
const mockSendApplicationOfferDeclinedHiringTeam = jest.fn();

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
    sendApplicationOfferShared: mockSendApplicationOfferShared,
    sendApplicationOfferAcceptedCandidate: mockSendApplicationOfferAcceptedCandidate,
    sendApplicationOfferDeclinedCandidate: mockSendApplicationOfferDeclinedCandidate,
    sendApplicationOfferAcceptedHiringTeam: mockSendApplicationOfferAcceptedHiringTeam,
    sendApplicationOfferDeclinedHiringTeam: mockSendApplicationOfferDeclinedHiringTeam,
  },
}));

jest.unstable_mockModule('../../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

const { ApplicationController } = await import('../application.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const baseOffer = {
  title: 'Senior Data Analyst Offer',
  compensationAmount: 450000,
  compensationCurrency: 'LKR',
  compensationPeriod: 'MONTHLY',
  startDate: '2099-04-01T00:00:00.000Z',
  expiresAt: '2099-04-15T12:00:00.000Z',
  note: 'Please review and respond in the portal.',
  status: 'PENDING',
  createdAt: '2026-03-10T09:00:00.000Z',
  createdBy: 'recruiter-1',
  updatedAt: '2026-03-10T09:00:00.000Z',
  updatedBy: 'recruiter-1',
  sentAt: '2026-03-10T09:00:00.000Z',
  respondedAt: null,
  acceptedAt: null,
  declinedAt: null,
  declineReason: null,
};

describe('ApplicationController offer flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([]);
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      fullName: 'Candidate One',
      email: 'candidate@example.com',
    });
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Data Analyst',
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
    });
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE' },
      { userId: 'admin-1', role: 'ADMIN', status: 'ACTIVE' },
    ]);
    mockUserStore.getSummary.mockImplementation(async (userId) => {
      if (userId === 'candidate-1') {
        return {
          id: 'candidate-1',
          fullName: 'Candidate One',
          email: 'candidate@example.com',
        };
      }
      if (userId === 'recruiter-1') {
        return {
          id: 'recruiter-1',
          fullName: 'Recruiter One',
          email: 'recruiter@example.com',
        };
      }
      if (userId === 'admin-1') {
        return {
          id: 'admin-1',
          fullName: 'Admin One',
          email: 'admin@example.com',
        };
      }
      return null;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows recruiter to create or update a structured offer for an offer-stage application', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: null,
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: payload.offer,
      offerHistory: payload.offerHistory,
    }));

    const req = {
      params: { id: 'app-1' },
      body: {
        title: 'Senior Data Analyst Offer',
        compensationAmount: 450000,
        compensationCurrency: 'LKR',
        compensationPeriod: 'MONTHLY',
        startDate: '2099-04-01T00:00:00.000Z',
        expiresAt: '2099-04-15T12:00:00.000Z',
        note: 'Please review and respond in the portal.',
      },
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

    await ApplicationController.upsertApplicationOffer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        offer: expect.objectContaining({
          title: 'Senior Data Analyst Offer',
          compensationAmount: 450000,
          compensationCurrency: 'LKR',
          compensationPeriod: 'MONTHLY',
          status: 'PENDING',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'SENT',
          }),
        ]),
      }),
    );
    expect(mockQueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPLICATION_OFFER_SHARED',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        offer: expect.objectContaining({
          title: 'Senior Data Analyst Offer',
          status: 'PENDING',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'SENT',
          }),
        ]),
      }),
    }));
  });

  it('allows recruiter to resend a pending offer without rewriting its content', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: {
        ...baseOffer,
        expiresAt: '2099-04-15T12:00:00.000Z',
      },
      offerHistory: [],
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: payload.offer,
      offerHistory: payload.offerHistory,
    }));

    const req = {
      params: { id: 'app-1' },
      user: {
        id: 'recruiter-1',
        fullName: 'Recruiter One',
        email: 'recruiter@example.com',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'RECRUITER' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.resendApplicationOffer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        offer: expect.objectContaining({
          status: 'PENDING',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'RESENT',
          }),
        ]),
      }),
    );
    expect(mockQueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPLICATION_OFFER_RESENT',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'Offer email resent successfully.',
    }));
  });

  it('allows the candidate to accept a pending offer and marks the application as hired', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: {
        ...baseOffer,
        expiresAt: '2099-04-15T12:00:00.000Z',
      },
      statusHistory: [],
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: payload.status || 'HIRED',
      offer: payload.offer,
      offerHistory: payload.offerHistory,
      statusHistory: payload.statusHistory || [],
    }));

    const req = {
      params: { id: 'app-1' },
      user: {
        id: 'candidate-1',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.acceptApplicationOffer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        status: 'HIRED',
        offer: expect.objectContaining({
          status: 'ACCEPTED',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'ACCEPTED',
          }),
        ]),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        status: 'HIRED',
        offer: expect.objectContaining({
          status: 'ACCEPTED',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'ACCEPTED',
          }),
        ]),
      }),
    }));
    expect(mockQueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPLICATION_OFFER_ACCEPTED_CANDIDATE',
    }));
  });

  it('allows the candidate to decline a pending offer without auto-rejecting the application', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: {
        ...baseOffer,
        expiresAt: '2099-04-15T12:00:00.000Z',
      },
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'OFFER',
      offer: payload.offer,
      offerHistory: payload.offerHistory,
    }));

    const req = {
      params: { id: 'app-1' },
      body: {
        declineReason: 'I decided to accept another offer.',
      },
      user: {
        id: 'candidate-1',
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.declineApplicationOffer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        offer: expect.objectContaining({
          status: 'DECLINED',
          declineReason: 'I decided to accept another offer.',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'DECLINED',
          }),
        ]),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        status: 'OFFER',
        offer: expect.objectContaining({
          status: 'DECLINED',
        }),
        offerHistory: expect.arrayContaining([
          expect.objectContaining({
            eventType: 'DECLINED',
          }),
        ]),
      }),
    }));
    expect(mockQueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPLICATION_OFFER_DECLINED_CANDIDATE',
    }));
  });
});
