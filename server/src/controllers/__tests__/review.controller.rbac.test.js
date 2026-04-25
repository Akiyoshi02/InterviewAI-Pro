import { afterEach, describe, expect, it, jest } from '@jest/globals';

const mockInterviewStore = {
  getById: jest.fn(),
  update: jest.fn(),
};

const mockReviewStore = {
  getByInterviewAndReviewer: jest.fn(),
  listByInterview: jest.fn(),
  submit: jest.fn(),
};

const mockUserStore = {
  getSummary: jest.fn(),
  getSummaries: jest.fn(),
};

const mockActivityLogStore = {
  record: jest.fn(),
};

const mockPublishAdminRealtimeUpdate = jest.fn();
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockRecordRealtimeEvent = jest.fn();

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  activityLogStore: mockActivityLogStore,
  interviewStore: mockInterviewStore,
  publishAdminRealtimeUpdate: mockPublishAdminRealtimeUpdate,
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  recordRealtimeEvent: mockRecordRealtimeEvent,
  reviewStore: mockReviewStore,
  userStore: mockUserStore,
}));

const { ReviewController } = await import('../review.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const buildReviewerRequest = (overrides = {}) => ({
  params: { interviewId: 'interview-1' },
  body: {
    decision: 'ADVANCE',
    notes: 'Strong performance.',
  },
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

const buildRecruiterRequest = (overrides = {}) => ({
  params: { interviewId: 'interview-1' },
  body: {
    decision: 'ADVANCE',
    notes: 'Strong performance.',
    rating: 9,
    overrideOverall: true,
  },
  user: {
    id: 'recruiter-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1' },
      membership: { role: 'RECRUITER' },
    },
  },
  ...overrides,
});

const buildAdminRequest = (overrides = {}) => ({
  params: { interviewId: 'interview-1' },
  body: {
    decision: 'ADVANCE',
    notes: 'Strong performance.',
    rating: 9,
    overrideOverall: true,
  },
  user: {
    id: 'admin-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1' },
      membership: { role: 'ADMIN' },
    },
  },
  ...overrides,
});

describe('ReviewController reviewer RBAC', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows submitted reviewer scores to assigned reviewers before they submit their own review', async () => {
    const req = buildReviewerRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1'],
      status: 'COMPLETED',
    });
    mockReviewStore.getByInterviewAndReviewer.mockResolvedValue(null);
    mockReviewStore.listByInterview.mockResolvedValue([
      { id: 'review-2', interviewId: 'interview-1', reviewerId: 'reviewer-2', createdAt: '2026-03-06T08:00:00.000Z' },
    ]);
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['reviewer-2', { id: 'reviewer-2', fullName: 'Peer Reviewer', email: 'reviewer-2@example.com' }],
    ]));

    await ReviewController.listReviews(req, res, next);

    expect(mockReviewStore.listByInterview).toHaveBeenCalledWith('interview-1');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      reviews: [
        expect.objectContaining({
          reviewerId: 'reviewer-2',
        }),
      ],
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('shows peer reviews to reviewers after they submit their own review', async () => {
    const req = buildReviewerRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1'],
      status: 'COMPLETED',
    });
    mockReviewStore.getByInterviewAndReviewer.mockResolvedValue({
      id: 'review-1',
      interviewId: 'interview-1',
      reviewerId: 'reviewer-1',
      decision: 'ADVANCE',
      createdAt: '2026-03-06T09:00:00.000Z',
      updatedAt: '2026-03-06T09:00:00.000Z',
    });
    mockReviewStore.listByInterview.mockResolvedValue([
      {
        id: 'review-1',
        interviewId: 'interview-1',
        reviewerId: 'reviewer-1',
        decision: 'ADVANCE',
        createdAt: '2026-03-06T09:00:00.000Z',
        updatedAt: '2026-03-06T09:00:00.000Z',
      },
      {
        id: 'review-2',
        interviewId: 'interview-1',
        reviewerId: 'reviewer-2',
        decision: 'HOLD',
        createdAt: '2026-03-06T08:00:00.000Z',
        updatedAt: '2026-03-06T08:00:00.000Z',
      },
    ]);
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['reviewer-1', { id: 'reviewer-1', fullName: 'Assigned Reviewer', email: 'reviewer-1@example.com' }],
      ['reviewer-2', { id: 'reviewer-2', fullName: 'Peer Reviewer', email: 'reviewer-2@example.com' }],
    ]));

    await ReviewController.listReviews(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      reviews: expect.arrayContaining([
        expect.objectContaining({ reviewerId: 'reviewer-1' }),
        expect.objectContaining({ reviewerId: 'reviewer-2' }),
      ]),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects reviewer submissions when the reviewer is not assigned to the interview', async () => {
    const req = buildReviewerRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: [],
      status: 'COMPLETED',
      overallScore: 82,
    });

    await ReviewController.submitReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NOT_ASSIGNED_REVIEWER',
    }));
    expect(mockReviewStore.submit).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('marks the matching review request completed when a reviewer submits feedback', async () => {
    const req = buildReviewerRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-06T08:00:00.000Z',
          dueAt: '2026-03-08T08:00:00.000Z',
          dueSource: 'AUTO',
          completedAt: null,
          completedReviewId: null,
        },
      ],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });
    mockReviewStore.submit.mockResolvedValue({
      id: 'review-1',
      interviewId: 'interview-1',
      reviewerId: 'reviewer-1',
      decision: 'ADVANCE',
      notes: 'Strong performance.',
      createdAt: '2026-03-06T09:00:00.000Z',
      updatedAt: '2026-03-06T09:05:00.000Z',
    });
    mockInterviewStore.update.mockResolvedValue({
      id: 'interview-1',
      reviewRequests: [],
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'reviewer-1',
      fullName: 'Assigned Reviewer',
      email: 'reviewer-1@example.com',
    });
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);

    await ReviewController.submitReview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        reviewRequests: expect.arrayContaining([
          expect.objectContaining({
            reviewerId: 'reviewer-1',
            completedReviewId: 'review-1',
            completedAt: '2026-03-06T09:05:00.000Z',
          }),
        ]),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      review: expect.objectContaining({ id: 'review-1' }),
    }));
  });

  it('allows reviewer submissions to override the final interview score as the SME', async () => {
    const req = buildReviewerRequest({
      body: {
        decision: 'ADVANCE',
        notes: 'Strong performance.',
        rating: 9,
        overrideOverall: true,
      },
    });
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });
    mockReviewStore.submit.mockResolvedValue({
      id: 'review-reviewer-override-1',
      interviewId: 'interview-1',
      reviewerId: 'reviewer-1',
      reviewerRole: 'REVIEWER',
      decision: 'ADVANCE',
      notes: 'Strong performance.',
      rating: 9,
      aiOverallScoreAtReview: 82,
      smeOverallScore: 90,
      overrideOverall: true,
      createdAt: '2026-03-06T09:00:00.000Z',
      updatedAt: '2026-03-06T09:05:00.000Z',
    });
    mockInterviewStore.update.mockResolvedValue({
      id: 'interview-1',
      finalOverallScore: 90,
      finalScoreSource: 'SME',
      reviewRequests: [],
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'reviewer-1',
      fullName: 'Assigned Reviewer',
      email: 'reviewer-1@example.com',
    });
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);

    await ReviewController.submitReview(req, res, next);

    expect(mockReviewStore.submit).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        reviewerId: 'reviewer-1',
        reviewerRole: 'REVIEWER',
        rating: 9,
        aiOverallScoreAtReview: 82,
        smeOverallScore: 90,
        overrideOverall: true,
      }),
    );
    expect(mockInterviewStore.update.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'interview-1',
          expect.objectContaining({
            finalOverallScore: 90,
            finalScoreSource: 'SME',
            officialSmeReviewerId: 'reviewer-1',
            officialSmeReviewerRole: 'REVIEWER',
            officialSmeReviewId: 'review-reviewer-override-1',
          }),
        ],
      ]),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      review: expect.objectContaining({
        aiOverallScoreAtReview: 82,
        smeOverallScore: 90,
        overrideOverall: true,
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('lets peer reviewers submit their own scores without changing the official SME final score', async () => {
    const req = buildReviewerRequest({
      user: {
        id: 'reviewer-2',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'REVIEWER' },
        },
      },
      body: {
        decision: 'HOLD',
        notes: 'Needs stronger architecture examples.',
        rating: 7,
      },
    });
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1', 'reviewer-2'],
      officialSmeReviewerId: 'reviewer-1',
      officialSmeReviewId: 'official-review-1',
      finalOverallScore: 90,
      finalScoreSource: 'SME',
      reviewRequests: [],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });
    mockReviewStore.submit.mockResolvedValue({
      id: 'review-peer-1',
      interviewId: 'interview-1',
      reviewerId: 'reviewer-2',
      reviewerRole: 'REVIEWER',
      decision: 'HOLD',
      notes: 'Needs stronger architecture examples.',
      rating: 7,
      aiOverallScoreAtReview: 82,
      smeOverallScore: 70,
      overrideOverall: false,
      createdAt: '2026-03-06T09:00:00.000Z',
      updatedAt: '2026-03-06T09:05:00.000Z',
    });
    mockInterviewStore.update.mockResolvedValue({
      id: 'interview-1',
      finalOverallScore: 90,
      finalScoreSource: 'SME',
      reviewRequests: [],
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'reviewer-2',
      fullName: 'Peer Reviewer',
      email: 'reviewer-2@example.com',
    });
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);

    await ReviewController.submitReview(req, res, next);

    expect(mockReviewStore.submit).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        reviewerId: 'reviewer-2',
        overrideOverall: false,
        smeOverallScore: 70,
      }),
    );
    expect(mockInterviewStore.update).toHaveBeenCalledTimes(1);
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        reviewRequests: expect.any(Array),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects recruiter attempts to override the final interview score', async () => {
    const req = buildRecruiterRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['recruiter-1'],
      reviewRequests: [],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });

    await ReviewController.submitReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_ORG_PERMISSIONS',
    }));
    expect(mockReviewStore.submit).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('persists SME override data and updates the interview final score for organization admin submissions', async () => {
    const req = buildAdminRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['admin-1'],
      reviewRequests: [],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });
    mockReviewStore.submit.mockResolvedValue({
      id: 'review-override-1',
      interviewId: 'interview-1',
      reviewerId: 'admin-1',
      reviewerRole: 'ADMIN',
      decision: 'ADVANCE',
      notes: 'Strong performance.',
      rating: 9,
      aiOverallScoreAtReview: 82,
      smeOverallScore: 90,
      overrideOverall: true,
      createdAt: '2026-03-06T09:00:00.000Z',
      updatedAt: '2026-03-06T09:05:00.000Z',
    });
    mockInterviewStore.update.mockResolvedValue({
      id: 'interview-1',
      finalOverallScore: 90,
      finalScoreSource: 'SME',
      reviewRequests: [],
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'admin-1',
      fullName: 'Org Admin',
      email: 'admin@example.com',
    });
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);

    await ReviewController.submitReview(req, res, next);

    expect(mockReviewStore.submit).toHaveBeenCalledWith(
      'interview-1',
      expect.objectContaining({
        reviewerId: 'admin-1',
        reviewerRole: 'ADMIN',
        rating: 9,
        aiOverallScoreAtReview: 82,
        smeOverallScore: 90,
        overrideOverall: true,
      }),
    );
    expect(mockInterviewStore.update.mock.calls).toEqual(
      expect.arrayContaining([
        [
          'interview-1',
          expect.objectContaining({
            finalOverallScore: 90,
            finalScoreSource: 'SME',
            officialSmeReviewerId: 'admin-1',
            officialSmeReviewerRole: 'ADMIN',
            officialSmeReviewId: 'review-override-1',
          }),
        ],
      ]),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      review: expect.objectContaining({
        aiOverallScoreAtReview: 82,
        smeOverallScore: 90,
        overrideOverall: true,
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects official SME overrides from a different reviewer once the official reviewer is set', async () => {
    const req = buildAdminRequest();
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1', 'admin-1'],
      officialSmeReviewerId: 'reviewer-1',
      officialSmeReviewId: 'official-review-1',
      reviewRequests: [],
      companyId: 'recruiter-1',
      status: 'COMPLETED',
      overallScore: 82,
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'reviewer-1',
      fullName: 'Official Reviewer',
      email: 'reviewer-1@example.com',
    });

    await ReviewController.submitReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'OFFICIAL_SME_REVIEWER_LOCKED',
      details: expect.objectContaining({
        officialSmeReviewerId: 'reviewer-1',
        officialSmeReviewId: 'official-review-1',
      }),
    }));
    expect(mockReviewStore.submit).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects override requests that do not provide an SME score', async () => {
    const req = buildReviewerRequest({
      body: {
        decision: 'ADVANCE',
        notes: 'Strong performance.',
        overrideOverall: true,
      },
    });
    const res = createResponse();
    const next = jest.fn();

    mockInterviewStore.getById.mockResolvedValue({
      id: 'interview-1',
      organizationId: 'org-1',
      reviewerAssignments: ['reviewer-1'],
      status: 'COMPLETED',
      overallScore: 82,
    });

    await ReviewController.submitReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SME_SCORE_REQUIRED_FOR_OVERRIDE',
    }));
    expect(mockReviewStore.submit).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
