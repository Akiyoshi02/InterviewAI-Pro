import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockInterviewStore = {
  getWithQuestions: jest.fn(),
  update: jest.fn(),
};

const mockInvitationStore = {
  getById: jest.fn(),
};

const mockJobApplicationStore = {
  update: jest.fn(),
};

const mockNotificationStore = {
  create: jest.fn(),
};

const mockOrganizationMemberStore = {
  listByOrganization: jest.fn(),
  getMember: jest.fn(),
};

const mockReviewStore = {
  getByInterviewAndReviewer: jest.fn(),
  listByInterview: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockUserStore = {
  getSummaries: jest.fn(),
};

const mockRecordRealtimeEvent = jest.fn();
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockPublishAdminRealtimeUpdate = jest.fn();
const mockUpdatePracticeStreak = jest.fn();

const mockGenerateInterviewSummary = jest.fn();
const mockOnFirstInterviewInternal = jest.fn();

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  activityLogStore: { record: jest.fn() },
  hydrateInterviewParticipants: jest.fn((interviews) => interviews || []),
  interviewStore: mockInterviewStore,
  invitationStore: mockInvitationStore,
  jobApplicationStore: mockJobApplicationStore,
  jobStore: {},
  organizationStore: { getById: jest.fn() },
  organizationMemberStore: mockOrganizationMemberStore,
  notificationStore: mockNotificationStore,
  publishAdminRealtimeUpdate: mockPublishAdminRealtimeUpdate,
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  recordRealtimeEvent: mockRecordRealtimeEvent,
  reviewStore: mockReviewStore,
  systemSettingsStore: { get: jest.fn() },
  updatePracticeStreak: mockUpdatePracticeStreak,
  userStore: mockUserStore,
}));

jest.unstable_mockModule('../../services/llm.service.js', () => ({
  LLMService: {
    generateInterviewSummary: mockGenerateInterviewSummary,
  },
}));

jest.unstable_mockModule('../referral.controller.js', () => ({
  ReferralController: {
    onFirstInterviewInternal: mockOnFirstInterviewInternal,
  },
}));

const { InterviewController } = await import('../interview.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const makeInterview = () => ({
  id: 'int-ref-1',
  mode: 'PRACTICE',
  status: 'IN_PROGRESS',
  candidateId: 'candidate-1',
  companyId: null,
  organizationId: null,
  invitationId: null,
  questions: [{ id: 'q-1', answer: 'Sample answer' }],
});

describe('InterviewController referral first-interview hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRecordRealtimeEvent.mockResolvedValue({});
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue({});
    mockPublishAdminRealtimeUpdate.mockResolvedValue({});
    mockUpdatePracticeStreak.mockResolvedValue({});
    mockInvitationStore.getById.mockResolvedValue(null);
    mockJobApplicationStore.update.mockResolvedValue({});
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockUserStore.getSummaries.mockResolvedValue(new Map());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const arrangeCommonSuccessPath = () => {
    const interview = makeInterview();

    mockInterviewStore.getWithQuestions.mockResolvedValue(interview);
    mockGenerateInterviewSummary.mockResolvedValue({
      overallScore: 83,
      readinessLevel: 'READY',
      strengths: [],
      improvements: [],
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...interview,
      ...payload,
      overallScore: payload.overallScore ?? 83,
      readinessLevel: payload.readinessLevel ?? 'READY',
      pendingEvaluation: payload.pendingEvaluation ?? false,
      llmUnavailable: payload.llmUnavailable ?? false,
    }));

    return interview;
  };

  it('calls referral bonus hook after interview completion', async () => {
    arrangeCommonSuccessPath();
    mockOnFirstInterviewInternal.mockResolvedValue({
      success: true,
      bonusPoints: 100,
    });

    const req = {
      params: { id: 'int-ref-1' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.endInterview(req, res, next);

    expect(mockInterviewStore.update).toHaveBeenCalledTimes(1);
    const [, updatePayload] = mockInterviewStore.update.mock.calls[0];
    expect(updatePayload.completedAt).toBe(updatePayload.endedAt);

    expect(mockOnFirstInterviewInternal).toHaveBeenCalledWith({ userId: 'candidate-1' });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      interview: expect.objectContaining({
        status: 'COMPLETED',
        completedAt: updatePayload.completedAt,
        endedAt: updatePayload.endedAt,
      }),
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('does not fail interview completion when referral hook errors', async () => {
    arrangeCommonSuccessPath();
    mockOnFirstInterviewInternal.mockRejectedValue(new Error('referral failed'));

    const req = {
      params: { id: 'int-ref-1' },
      user: { id: 'candidate-1', accountType: 'CANDIDATE' },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.endInterview(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      interview: expect.objectContaining({ status: 'COMPLETED' }),
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
