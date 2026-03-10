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

describe('ReviewController reviewer RBAC', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('hides peer reviews from reviewers until they submit their own review', async () => {
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
    mockUserStore.getSummaries.mockResolvedValue(new Map());

    await ReviewController.listReviews(req, res, next);

    expect(mockReviewStore.listByInterview).not.toHaveBeenCalled();
    expect(mockUserStore.getSummaries).toHaveBeenCalledWith([]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      reviews: [],
    });
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

  it('rejects reviewer attempts to override the final interview score', async () => {
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

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INSUFFICIENT_ORG_PERMISSIONS',
    }));
    expect(mockReviewStore.submit).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
