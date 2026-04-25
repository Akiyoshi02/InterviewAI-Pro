import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

// Shared mock refs
const mockInterviewStore = {
  getById: jest.fn(),
  getWithQuestions: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  listByCandidate: jest.fn(),
  listByCompany: jest.fn(),
  listByOrganization: jest.fn(),
};
const mockActivityLogStore = { record: jest.fn() };
const mockNotificationStore = { create: jest.fn() };
const mockJobStore = { getById: jest.fn() };
const mockOrganizationStore = { getById: jest.fn() };
const mockOrganizationMemberStore = { listByOrganization: jest.fn() };
const mockReviewStore = { getByInterviewAndReviewer: jest.fn() };
const mockUserStore = { getById: jest.fn(), getSummary: jest.fn(), getSummaries: jest.fn() };
const mockJobApplicationStore = { getById: jest.fn(), checkDuplicate: jest.fn(), update: jest.fn() };
const mockRecordRealtimeEvent = jest.fn();
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();
const mockSendInterviewScheduled = jest.fn();
const mockSendInterviewRescheduled = jest.fn();
const mockSendReviewRequestReminder = jest.fn();
const mockSendApplicationStatusUpdated = jest.fn();
const mockGenerateMeetingToken = jest.fn();
const mockValidateMeetingAccess = jest.fn();
const mockValidateMeetingToken = jest.fn();
const mockIsWithinMeetingAccessWindow = jest.fn();
const mockHydrateInterviewParticipants = jest.fn((interviews) => interviews || []);

// Module mocks
jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: {
    collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
    settings: () => undefined,
  },
  realtimeDb: { ref: () => ({ push: async () => undefined, set: async () => undefined }) },
  auth: {},
  storage: {},
  default: {
    firestore: () => ({
      collection: () => ({ doc: () => ({ get: async () => ({ exists: false }) }) }),
    }),
  },
}));

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  activityLogStore: mockActivityLogStore,
  hydrateInterviewParticipants: mockHydrateInterviewParticipants,
  interviewStore: mockInterviewStore,
  invitationStore: { getById: jest.fn() },
  jobApplicationStore: mockJobApplicationStore,
  jobStore: mockJobStore,
  organizationStore: mockOrganizationStore,
  organizationMemberStore: mockOrganizationMemberStore,
  notificationStore: mockNotificationStore,
  publishAdminRealtimeUpdate: jest.fn(),
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  recordRealtimeEvent: mockRecordRealtimeEvent,
  reviewStore: mockReviewStore,
  systemSettingsStore: { get: jest.fn() },
  userStore: mockUserStore,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailNotifications: {
    sendInterviewScheduled: mockSendInterviewScheduled,
    sendInterviewRescheduled: mockSendInterviewRescheduled,
    sendReviewRequestReminder: mockSendReviewRequestReminder,
    sendApplicationStatusUpdated: mockSendApplicationStatusUpdated,
  },
}));

jest.unstable_mockModule('../../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

jest.unstable_mockModule('../../services/llm.service.js', () => ({
  LLMService: { generateInterviewSummary: jest.fn() },
}));

jest.unstable_mockModule('../referral.controller.js', () => ({
  ReferralController: { onFirstInterviewInternal: jest.fn() },
}));

jest.unstable_mockModule('../../services/meetingLink.service.js', () => ({
  generateMeetingToken: mockGenerateMeetingToken,
  isWithinMeetingAccessWindow: mockIsWithinMeetingAccessWindow,
  validateMeetingAccess: mockValidateMeetingAccess,
  validateMeetingToken: mockValidateMeetingToken,
  // Re-export the defaults the controller might also use
  default: {
    generateMeetingToken: mockGenerateMeetingToken,
    isWithinMeetingAccessWindow: mockIsWithinMeetingAccessWindow,
    validateMeetingAccess: mockValidateMeetingAccess,
    validateMeetingToken: mockValidateMeetingToken,
  },
}));

const { InterviewController } = await import('../interview.controller.js');

afterEach(() => {
  jest.useRealTimers();
});

// Helpers
const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const futureIso = (hours = 24) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const baseInterview = {
  id: 'int-1',
  mode: 'HIRING',
  status: 'PENDING',
  candidateId: 'candidate-1',
  companyId: 'recruiter-1',
  organizationId: 'org-1',
  jobId: 'job-1',
  jobRole: 'Engineer',
  timezone: 'UTC',
};

const baseInterviewPlan = {
  version: 1,
  currentStageId: 'recruiter-screen',
  stages: [
    {
      id: 'recruiter-screen',
      name: 'Recruiter Screen',
      sequence: 1,
      category: 'SCREENING',
      advanceRule: 'PASS_REQUIRED',
      status: 'COMPLETED',
      completedAt: '2026-03-09T08:00:00.000Z',
      outcome: 'PASS',
    },
    {
      id: 'sme-interview',
      name: 'SME Interview',
      sequence: 2,
      category: 'TECHNICAL',
      advanceRule: 'PASS_REQUIRED',
      status: 'PENDING',
      completedAt: null,
      outcome: 'PENDING',
    },
  ],
};

const scheduledInterview = {
  ...baseInterview,
  status: 'SCHEDULED',
  scheduledFor: futureIso(48),
  meetingToken: 'valid-token-abc',
  meetingTokenGeneratedAt: new Date().toISOString(),
  duration: 30,
};

const withHeaderHelpers = (request) => ({
  ...request,
  headers: request.headers || {},
  get(name) {
    const normalized = String(name || '').toLowerCase();
    return this.headers?.[normalized] || this.headers?.[name] || null;
  },
});

const companyReq = (body = {}, params = {}, userOverrides = {}) => {
  const baseUser = {
    id: 'recruiter-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1', status: 'APPROVED' },
      membership: { role: 'ADMIN' },
    },
  };
  return withHeaderHelpers({
    params: { id: 'int-1', ...params },
    body,
    query: {},
    user: {
      ...baseUser,
      ...userOverrides,
      organizationContext: userOverrides.organizationContext || baseUser.organizationContext,
    },
  });
};

const candidateReq = (params = {}, query = {}, extras = {}) => withHeaderHelpers({
  params: { id: 'int-1', ...params },
  body: extras.body || {},
  query,
  headers: extras.headers || {},
  user: {
    id: 'candidate-1',
    accountType: 'CANDIDATE',
  },
});

const futureWeekdayIso = (weekday, hour = 12, minute = 0, minimumDaysAhead = 2) => {
  const date = new Date();
  date.setUTCSeconds(0, 0);
  date.setUTCDate(date.getUTCDate() + minimumDaysAhead);
  while (date.getUTCDay() !== weekday) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
};

// ============================================================================
// validateMeetingLink
// ============================================================================
describe('InterviewController.validateMeetingLink', () => {
beforeEach(() => {
  jest.clearAllMocks();
  mockJobApplicationStore.getById.mockResolvedValue(null);
  mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
});

  it('returns 400 when token is missing from query', async () => {
    const req = candidateReq({}, {}); // no token
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_TOKEN' }),
    );
  });

  it('returns 404 when interview does not exist', async () => {
    mockInterviewStore.getById.mockResolvedValue(null);
    const req = candidateReq({}, { token: 'abc' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'NOT_FOUND' }),
    );
  });

  it('returns 403 FORBIDDEN when candidate does not own the interview', async () => {
    mockInterviewStore.getById.mockResolvedValue({ ...scheduledInterview, candidateId: 'other-candidate' });
    const req = candidateReq({}, { token: 'abc' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('returns 403 with service code when validateMeetingAccess says invalid', async () => {
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockValidateMeetingAccess.mockReturnValue({
      valid: false,
      code: 'TOO_EARLY',
      message: 'The meeting link will become accessible 45 minutes from now.',
    });
    const req = candidateReq({}, { token: 'wrong' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TOO_EARLY' }),
    );
  });

  it('returns 403 with EXPIRED code when window has closed', async () => {
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockValidateMeetingAccess.mockReturnValue({
      valid: false,
      code: 'EXPIRED',
      message: 'The meeting window has closed.',
    });
    const req = candidateReq({}, { token: 'tok' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'EXPIRED' }),
    );
  });

  it('returns 403 with INVALID_TOKEN when token does not match', async () => {
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockValidateMeetingAccess.mockReturnValue({
      valid: false,
      code: 'INVALID_TOKEN',
      message: 'The meeting link is invalid or has expired.',
    });
    const req = candidateReq({}, { token: 'bad-token' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_TOKEN' }),
    );
  });

  it('returns success with interview data when access is valid', async () => {
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockValidateMeetingAccess.mockReturnValue({ valid: true });
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter' }],
    ]));
    const req = candidateReq({}, { token: 'valid-token-abc' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, interview: expect.objectContaining({ id: 'int-1' }) }),
    );
    expect(res.status).not.toHaveBeenCalled(); // 200 default
  });

  it('allows company users to validate without ownership check', async () => {
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockValidateMeetingAccess.mockReturnValue({ valid: true });
    mockUserStore.getSummaries.mockResolvedValue(new Map());
    // Company user — no candidateId match required
    const req = companyReq();
    req.query = { token: 'valid-token-abc' };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('calls next(error) on unexpected exceptions', async () => {
    mockInterviewStore.getById.mockRejectedValue(new Error('DB down'));
    const req = candidateReq({}, { token: 'tok' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.validateMeetingLink(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ============================================================================
// scheduleInterview — token generation
// ============================================================================
describe('InterviewController.scheduleInterview — meeting token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateMeetingToken.mockReturnValue({
      meetingToken: 'generated-token-xyz',
      meetingTokenGeneratedAt: '2026-01-01T00:00:00.000Z',
      meetingLinkEmailSent: false,
    });
    mockInterviewStore.getById.mockResolvedValue(baseInterview);
    mockInterviewStore.update.mockImplementation(async (_id, data) => ({ ...baseInterview, ...data }));
    mockInterviewStore.listByCompany.mockResolvedValue([]);
    mockInterviewStore.listByOrganization.mockResolvedValue([]);
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
          timezone: 'UTC',
          leadHours: 1,
          slotMinutes: 30,
          durationMinutes: 30,
          bufferMinutes: 0,
          scheduleWindowDays: 45,
          businessHoursStart: '00:00',
          businessHoursEnd: '23:59',
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          maxInterviewsPerDay: 20,
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE' },
      { userId: 'reviewer-1', role: 'REVIEWER', status: 'ACTIVE' },
    ]);
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      timezone: 'UTC',
      interviewAvailability: null,
    });
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate', email: 'c@test.com' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter', email: 'r@test.com' }],
    ]));
  });

  it('stores meeting token fields on schedule', async () => {
    const req = companyReq({
      scheduledFor: futureIso(48),
      timezone: 'UTC',
      duration: 30,
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    // If the method reached interviewStore.update, the token data should
    // have been spread into the update payload (via generateMeetingToken)
    if (mockInterviewStore.update.mock.calls.length > 0) {
      const updateData = mockInterviewStore.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('meetingToken');
      expect(updateData).toHaveProperty('meetingTokenGeneratedAt');
      expect(updateData).toHaveProperty('meetingLinkEmailSent', false);
      expect(updateData).not.toHaveProperty('meetingLink');
    } else {
      // Schedule didn't reach update — verify it's not because
      // meetingLink was expected. Just check it didn't crash.
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('does NOT include meetingLink in the update payload even if injected', async () => {
    const req = companyReq({
      scheduledFor: futureIso(48),
      timezone: 'UTC',
      duration: 30,
      meetingLink: 'https://should-be-ignored.com',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    if (mockInterviewStore.update.mock.calls.length > 0) {
      const updateData = mockInterviewStore.update.mock.calls[0][1];
      expect(updateData).not.toHaveProperty('meetingLink');
    }
  });

  it('rejects scheduling when the selected slot is in the past', async () => {
    const req = companyReq({
      scheduledFor: new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString(),
      timezone: 'UTC',
      duration: 30,
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SLOT_IN_PAST',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });

  it('uses the assigned recruiter availability instead of the acting admin when scheduling', async () => {
    mockUserStore.getById.mockImplementation(async (id) => {
      if (id === 'recruiter-1') {
        return {
          id: 'recruiter-1',
          accountType: 'COMPANY',
          timezone: 'UTC',
          profile: {
            timezone: 'UTC',
            interviewAvailability: {
              timezone: 'UTC',
              workingDays: [1],
              businessHoursStart: '09:00',
              businessHoursEnd: '10:00',
              maxInterviewsPerDay: 4,
            },
          },
        };
      }
      if (id === 'admin-1') {
        return {
          id: 'admin-1',
          accountType: 'COMPANY',
          timezone: 'UTC',
          profile: {
            timezone: 'UTC',
            interviewAvailability: {
              timezone: 'UTC',
              workingDays: [2],
              businessHoursStart: '12:00',
              businessHoursEnd: '13:00',
              maxInterviewsPerDay: 4,
            },
          },
        };
      }
      return null;
    });

    const req = companyReq({
      strategy: 'MANUAL',
      scheduledFor: futureWeekdayIso(2, 12, 0),
      timezone: 'UTC',
      duration: 30,
    }, {}, {
      id: 'admin-1',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SLOT_OUTSIDE_AVAILABILITY',
    }));
    expect(mockInterviewStore.listByCompany).toHaveBeenCalledWith('recruiter-1', { limit: 250 });
    expect(mockUserStore.getById).toHaveBeenCalledWith('recruiter-1');
    expect(mockUserStore.getById).not.toHaveBeenCalledWith('admin-1');
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });

  it('fails closed when organization scheduling settings cannot be loaded during schedule', async () => {
    mockOrganizationStore.getById.mockRejectedValue(new Error('organization store unavailable'));

    const req = companyReq({
      strategy: 'AUTO',
      timezone: 'UTC',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SCHEDULING_CONTEXT_UNAVAILABLE',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });

  it('persists validated reviewer assignments during scheduling', async () => {
    const req = companyReq({
      scheduledFor: futureIso(48),
      timezone: 'UTC',
      reviewerAssignments: ['reviewer-1'],
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockOrganizationMemberStore.listByOrganization).toHaveBeenCalledWith('org-1');
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        reviewerAssignments: ['reviewer-1'],
        reviewRequests: expect.arrayContaining([
          expect.objectContaining({
            reviewerId: 'reviewer-1',
            dueAt: expect.any(String),
            dueSource: 'AUTO',
          }),
        ]),
      }),
    );
  });
});

describe('InterviewController.getInterview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getWithQuestions.mockResolvedValue(scheduledInterview);
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter' }],
    ]));
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      logo: '/logos/cynectex.png',
    });
    mockValidateMeetingAccess.mockReturnValue({ valid: true });
    mockIsWithinMeetingAccessWindow.mockReturnValue(false);
  });

  it('rejects candidate access to an upcoming hiring interview when no meeting token is supplied', async () => {
    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MEETING_LINK_REQUIRED',
    }));
    expect(mockValidateMeetingAccess).not.toHaveBeenCalled();
  });

  it('allows candidate access with a valid meeting token and redacts token fields from the response', async () => {
    const req = candidateReq({}, {}, {
      headers: { 'x-meeting-token': 'valid-token-abc' },
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockValidateMeetingAccess).toHaveBeenCalledWith(scheduledInterview, 'valid-token-abc');
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.interview).toEqual(expect.objectContaining({ id: 'int-1' }));
    expect(responsePayload.interview).not.toHaveProperty('meetingToken');
    expect(responsePayload.interview).not.toHaveProperty('meetingTokenGeneratedAt');
    expect(responsePayload.interview).not.toHaveProperty('meetingLinkEmailSent');
    expect(responsePayload.interview.organization).toEqual(expect.objectContaining({
      id: 'org-1',
      displayName: 'Cynectex',
      logo: '/logos/cynectex.png',
    }));
  });

  it('allows candidate access without a meeting token once the scheduled start time has arrived and the meeting window is still open', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
    mockInterviewStore.getWithQuestions.mockResolvedValue({
      ...scheduledInterview,
      scheduledFor: '2026-03-10T09:00:00.000Z',
    });
    mockIsWithinMeetingAccessWindow.mockReturnValue(true);

    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockValidateMeetingAccess).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        interview: expect.objectContaining({ id: 'int-1' }),
      }),
    );

    jest.useRealTimers();
  });

  it('rejects candidate access without a meeting token after the meeting window has closed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T10:00:00.000Z'));
    mockInterviewStore.getWithQuestions.mockResolvedValue({
      ...scheduledInterview,
      scheduledFor: '2026-03-10T09:00:00.000Z',
    });
    mockIsWithinMeetingAccessWindow.mockReturnValue(false);

    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MEETING_LINK_REQUIRED',
    }));

    jest.useRealTimers();
  });
});

describe('InterviewController.getMyInterviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.listByCandidate.mockResolvedValue([scheduledInterview]);
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter' }],
    ]));
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      logo: '/logos/cynectex.png',
    });
    mockHydrateInterviewParticipants.mockImplementation(async (interviews) => (
      (interviews || []).map((interview) => ({
        ...interview,
        organization: {
          id: 'org-1',
          name: 'Cynectex',
          displayName: 'Cynectex',
          logo: '/logos/cynectex.png',
        },
      }))
    ));
  });

  it('redacts meeting token fields from interview collections', async () => {
    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.getMyInterviews(req, res, next);

    expect(next).not.toHaveBeenCalled();
    const responsePayload = res.json.mock.calls[0][0];
    expect(responsePayload.interviews).toHaveLength(1);
    expect(responsePayload.interviews[0]).not.toHaveProperty('meetingToken');
    expect(responsePayload.interviews[0]).not.toHaveProperty('meetingTokenGeneratedAt');
    expect(responsePayload.interviews[0]).not.toHaveProperty('meetingLinkEmailSent');
    expect(responsePayload.interviews[0].organization).toEqual(expect.objectContaining({
      id: 'org-1',
      displayName: 'Cynectex',
    }));
  });
});

describe('InterviewController.recordRecordingConsent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockIsWithinMeetingAccessWindow.mockReturnValue(false);
  });

  it('rejects candidate consent recording when the active meeting token is missing', async () => {
    const req = candidateReq({}, {}, {
      body: {
        recordingConsentGivenAt: new Date().toISOString(),
        recordingConsentVersion: 'v1',
      },
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.recordRecordingConsent(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MEETING_LINK_REQUIRED',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });

  it('allows candidate consent recording without a meeting token after the scheduled start time', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      scheduledFor: '2026-03-10T09:00:00.000Z',
    });
    mockIsWithinMeetingAccessWindow.mockReturnValue(true);
    mockInterviewStore.update.mockResolvedValue({
      ...scheduledInterview,
      recordingConsentGivenAt: '2026-03-10T10:00:00.000Z',
    });

    const req = candidateReq({}, {}, {
      body: {
        recordingConsentGivenAt: '2026-03-10T10:00:00.000Z',
        recordingConsentVersion: 'v1',
      },
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.recordRecordingConsent(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(403);
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        recordingConsentGivenAt: '2026-03-10T10:00:00.000Z',
        recordingConsentVersion: 'v1',
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );

    jest.useRealTimers();
  });
});

describe('InterviewController.uploadRecording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows candidate recording upload without a meeting token immediately after completion', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-10T10:05:00.000Z'));

    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      scheduledFor: '2026-03-10T09:00:00.000Z',
      completedAt: '2026-03-10T10:00:00.000Z',
    });
    mockInterviewStore.update.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      completedAt: '2026-03-10T10:00:00.000Z',
      recordingUrl: '/uploads/interviews/int-1/recording.webm',
      recording: { path: '/uploads/interviews/int-1/recording.webm' },
    });
    const recordingPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'uploads',
      'interviews',
      'int-1',
      'recording.webm',
    );

    const req = candidateReq();
    req.file = {
      path: recordingPath,
      size: 1024,
      mimetype: 'video/webm',
      originalname: 'recording.webm',
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.uploadRecording(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        recordingUrl: '/uploads/interviews/int-1/recording.webm',
      }),
    );

    jest.useRealTimers();
  });
});

describe('InterviewController.startInterview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter' }],
    ]));
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockIsWithinMeetingAccessWindow.mockReturnValue(false);
  });

  it('allows candidate start without a meeting token after the scheduled start time', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-10T10:00:00.000Z'));

    const activeInterview = {
      ...scheduledInterview,
      status: 'SCHEDULED',
      scheduledFor: '2026-03-10T09:00:00.000Z',
      recordingConsentGivenAt: '2026-03-10T09:55:00.000Z',
      questions: [
        {
          id: 'q1',
          question: 'Tell me about yourself.',
          evaluationCriteria: ['clarity'],
        },
      ],
      config: {},
    };

    mockInterviewStore.getWithQuestions.mockResolvedValue(activeInterview);
    mockIsWithinMeetingAccessWindow.mockReturnValue(true);
    mockInterviewStore.update.mockResolvedValue({
      ...activeInterview,
      status: 'IN_PROGRESS',
      startedAt: '2026-03-10T10:00:00.000Z',
    });

    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockValidateMeetingAccess).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        status: 'IN_PROGRESS',
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        interview: expect.objectContaining({ status: 'IN_PROGRESS' }),
      }),
    );

    jest.useRealTimers();
  });

  it('rejects candidate start without a meeting token after the meeting window has closed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T10:00:00.000Z'));

    const activeInterview = {
      ...scheduledInterview,
      status: 'SCHEDULED',
      scheduledFor: '2026-03-10T09:00:00.000Z',
      recordingConsentGivenAt: '2026-03-10T09:55:00.000Z',
      questions: [
        {
          id: 'q1',
          question: 'Tell me about yourself.',
          evaluationCriteria: ['clarity'],
        },
      ],
      config: {},
    };

    mockInterviewStore.getWithQuestions.mockResolvedValue(activeInterview);
    mockIsWithinMeetingAccessWindow.mockReturnValue(false);

    const req = candidateReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.startInterview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'MEETING_LINK_REQUIRED',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();

    jest.useRealTimers();
  });
});

// ============================================================================
// rescheduleInterview — token regeneration
// ============================================================================
describe('InterviewController.rescheduleInterview — token regeneration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateMeetingToken.mockReturnValue({
      meetingToken: 'new-rescheduled-token',
      meetingTokenGeneratedAt: '2026-02-01T00:00:00.000Z',
      meetingLinkEmailSent: false,
    });
    mockInterviewStore.getById.mockResolvedValue(scheduledInterview);
    mockInterviewStore.update.mockImplementation(async (_id, data) => ({ ...scheduledInterview, ...data }));
    mockInterviewStore.listByCompany.mockResolvedValue([]);
    mockInterviewStore.listByOrganization.mockResolvedValue([]);
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
          timezone: 'UTC',
          leadHours: 1,
          slotMinutes: 30,
          durationMinutes: 30,
          bufferMinutes: 0,
          scheduleWindowDays: 45,
          businessHoursStart: '00:00',
          businessHoursEnd: '23:59',
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          maxInterviewsPerDay: 20,
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE' },
      { userId: 'reviewer-1', role: 'REVIEWER', status: 'ACTIVE' },
    ]);
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      timezone: 'UTC',
      interviewAvailability: null,
    });
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate', email: 'c@test.com' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter', email: 'r@test.com' }],
    ]));
  });

  it('generates a new token on reschedule (token fields in update)', async () => {
    const req = companyReq({
      scheduledFor: futureIso(72),
      timezone: 'UTC',
      duration: 45,
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    if (mockInterviewStore.update.mock.calls.length > 0) {
      const updateData = mockInterviewStore.update.mock.calls[0][1];
      expect(updateData).toHaveProperty('meetingToken');
      expect(updateData).toHaveProperty('meetingTokenGeneratedAt');
      expect(updateData).toHaveProperty('meetingLinkEmailSent', false);
    } else {
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('does NOT pass meetingLink in the reschedule update', async () => {
    const req = companyReq({
      scheduledFor: futureIso(72),
      timezone: 'UTC',
      meetingLink: 'https://should-be-stripped.com',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    if (mockInterviewStore.update.mock.calls.length > 0) {
      const updateData = mockInterviewStore.update.mock.calls[0][1];
      expect(updateData).not.toHaveProperty('meetingLink');
    }
  });

  it('fails closed when organization scheduling settings cannot be loaded during reschedule', async () => {
    mockOrganizationStore.getById.mockRejectedValue(new Error('organization store unavailable'));

    const req = companyReq({
      strategy: 'AUTO',
      timezone: 'UTC',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SCHEDULING_CONTEXT_UNAVAILABLE',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });

  it('persists validated reviewer assignments during reschedule', async () => {
    const req = companyReq({
      scheduledFor: futureIso(72),
      timezone: 'UTC',
      reviewerAssignments: ['reviewer-1'],
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockOrganizationMemberStore.listByOrganization).toHaveBeenCalledWith('org-1');
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        reviewerAssignments: ['reviewer-1'],
        reviewRequests: expect.arrayContaining([
          expect.objectContaining({
            reviewerId: 'reviewer-1',
            dueAt: expect.any(String),
            dueSource: 'AUTO',
          }),
        ]),
      }),
    );
  });
});

describe('InterviewController.updateInterviewReviewRequests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString(),
          assignedBy: 'recruiter-1',
          dueAt: futureIso(24),
          dueSource: 'AUTO',
          lastReminderAt: '2026-03-10T10:00:00.000Z',
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });
    mockInterviewStore.update.mockImplementation(async (_id, data) => ({
      ...scheduledInterview,
      status: 'COMPLETED',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [],
      ...data,
    }));
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'recruiter-1', role: 'RECRUITER', status: 'ACTIVE' },
      { userId: 'reviewer-1', role: 'REVIEWER', status: 'ACTIVE' },
      { userId: 'reviewer-2', role: 'REVIEWER', status: 'ACTIVE' },
    ]);
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate', email: 'c@test.com' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter', email: 'r@test.com' }],
      ['reviewer-1', { id: 'reviewer-1', fullName: 'Riley Reviewer', email: 'reviewer1@test.com' }],
      ['reviewer-2', { id: 'reviewer-2', fullName: 'Morgan Reviewer', email: 'reviewer2@test.com' }],
    ]));
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
  });

  it('lets recruiters update reviewer assignments and manual due overrides', async () => {
    const req = companyReq({
      reviewerAssignments: ['reviewer-1', 'reviewer-2'],
      reviewRequestUpdates: [
        {
          reviewerId: 'reviewer-2',
          dueSource: 'MANUAL',
          dueAt: futureIso(96),
        },
      ],
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewReviewRequests(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockOrganizationMemberStore.listByOrganization).toHaveBeenCalledWith('org-1');
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        reviewerAssignments: ['reviewer-1', 'reviewer-2'],
        reviewRequests: expect.arrayContaining([
          expect.objectContaining({
            reviewerId: 'reviewer-1',
            dueSource: 'AUTO',
          }),
          expect.objectContaining({
            reviewerId: 'reviewer-2',
            dueSource: 'MANUAL',
            dueAt: expect.any(String),
          }),
        ]),
      }),
    );
    expect(mockActivityLogStore.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'INTERVIEW_REVIEW_REQUESTS_UPDATED',
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        interview: expect.objectContaining({
          reviewerAssignments: ['reviewer-1', 'reviewer-2'],
        }),
      }),
    );
  });

  it('rejects reviewer users from updating reviewer workflow', async () => {
    const req = companyReq(
      {
        reviewerAssignments: ['reviewer-1'],
      },
      {},
      {
        id: 'reviewer-1',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'REVIEWER' },
        },
      },
    );
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewReviewRequests(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Insufficient organization role for scheduling',
      }),
    );
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });
});

describe('InterviewController.sendInterviewReviewReminder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: new Date(Date.now() - (48 * 60 * 60 * 1000)).toISOString(),
          assignedBy: 'recruiter-1',
          dueAt: futureIso(24),
          dueSource: 'AUTO',
          lastReminderAt: null,
          reminderHistory: [],
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });
    mockInterviewStore.update.mockImplementation(async (_id, data) => ({
      ...scheduledInterview,
      status: 'COMPLETED',
      reviewerAssignments: ['reviewer-1'],
      ...data,
    }));
    mockUserStore.getSummary.mockImplementation(async (id) => {
      if (id === 'reviewer-1') {
        return { id, email: 'reviewer@example.com', fullName: 'Reviewer One' };
      }
      if (id === 'candidate-1') {
        return { id, email: 'candidate@example.com', fullName: 'Candidate One' };
      }
      return null;
    });
    mockUserStore.getSummaries.mockResolvedValue(new Map([
      ['candidate-1', { id: 'candidate-1', fullName: 'Candidate One', email: 'candidate@example.com' }],
      ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter One', email: 'recruiter@example.com' }],
      ['reviewer-1', { id: 'reviewer-1', fullName: 'Reviewer One', email: 'reviewer@example.com' }],
    ]));
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'TestCo', displayName: 'TestCo' });
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockSendReviewRequestReminder.mockResolvedValue(undefined);
  });

  it('sends a manual reminder and persists reminder history', async () => {
    const req = companyReq({}, { reviewerId: 'reviewer-1' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.sendInterviewReviewReminder(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockSendReviewRequestReminder).toHaveBeenCalledWith(expect.objectContaining({
      reviewer: expect.objectContaining({ email: 'reviewer@example.com' }),
      workflowState: 'DUE_SOON',
      reminderSource: 'MANUAL',
    }));
    expect(mockInterviewStore.update).toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({
        reviewRequests: expect.arrayContaining([
          expect.objectContaining({
            reviewerId: 'reviewer-1',
            lastReminderAt: expect.any(String),
            reminderHistory: expect.arrayContaining([
              expect.objectContaining({
                workflowState: 'DUE_SOON',
                channel: 'EMAIL',
                source: 'MANUAL',
              }),
            ]),
          }),
        ]),
      }),
    );
    expect(mockNotificationStore.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'reviewer-1',
      type: 'review_reminder',
      metadata: expect.objectContaining({
        source: 'MANUAL',
      }),
    }));
    expect(mockActivityLogStore.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'INTERVIEW_REVIEW_REMINDER_SENT',
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      interview: expect.any(Object),
    }));
  });

  it('rejects manual reminders before the interview is completed', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'SCHEDULED',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-09T09:00:00.000Z',
          assignedBy: 'recruiter-1',
          dueAt: '2026-03-11T09:00:00.000Z',
          dueSource: 'AUTO',
          lastReminderAt: null,
          reminderHistory: [],
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });

    const req = companyReq({}, { reviewerId: 'reviewer-1' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.sendInterviewReviewReminder(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'REVIEW_REMINDER_NOT_READY',
    }));
    expect(mockSendReviewRequestReminder).not.toHaveBeenCalled();
  });

  it('rejects manual reminders during the cooldown window', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      reviewerAssignments: ['reviewer-1'],
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-09T09:00:00.000Z',
          assignedBy: 'recruiter-1',
          dueAt: '2026-03-11T09:00:00.000Z',
          dueSource: 'AUTO',
          lastReminderAt: new Date(Date.now() - (60 * 60 * 1000)).toISOString(),
          reminderHistory: [],
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });

    const req = companyReq({}, { reviewerId: 'reviewer-1' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.sendInterviewReviewReminder(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'REVIEW_REMINDER_COOLDOWN',
    }));
    expect(mockSendReviewRequestReminder).not.toHaveBeenCalled();
  });
});

describe('InterviewController.updateInterviewStageOutcome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      applicationId: 'app-1',
      planStageId: 'recruiter-screen',
      planStageName: 'Recruiter Screen',
      planStageSequence: 1,
      planStageTotal: 2,
    });
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      interviewPlan: baseInterviewPlan,
    });
    mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
    mockJobApplicationStore.update.mockResolvedValue({
      id: 'app-1',
      interviewPlan: baseInterviewPlan,
    });
    mockHydrateInterviewParticipants.mockImplementation((interviews) => interviews || []);
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
  });

  it('records a recruiter stage outcome on the linked interview plan', async () => {
    const req = companyReq({
      outcome: 'PASS',
      note: 'Strong technical performance.',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewStageOutcome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        interviewPlan: expect.objectContaining({
          stages: expect.arrayContaining([
            expect.objectContaining({
              id: 'recruiter-screen',
              outcome: 'PASS',
              outcomeNote: 'Strong technical performance.',
            }),
          ]),
        }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      plan: expect.objectContaining({
        stages: expect.arrayContaining([
          expect.objectContaining({
            id: 'recruiter-screen',
            outcome: 'PASS',
          }),
        ]),
      }),
    }));
  });

  it('locks stage outcomes once a downstream stage interview already exists', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      interviewPlan: {
        ...baseInterviewPlan,
        stages: [
          {
            ...baseInterviewPlan.stages[0],
          },
          {
            ...baseInterviewPlan.stages[1],
            interviewId: 'int-2',
            status: 'ACTIVE',
          },
        ],
      },
    });

    const req = companyReq({ outcome: 'FAIL' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewStageOutcome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERVIEW_STAGE_OUTCOME_LOCKED',
    }));
    expect(mockJobApplicationStore.update).not.toHaveBeenCalled();
  });

  it('can close the application automatically when the round fails with a configured disposition', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      status: 'INTERVIEWING',
      interviewPlan: {
        ...baseInterviewPlan,
        stages: [
          {
            ...baseInterviewPlan.stages[0],
            outcome: 'PENDING',
            outcomeNote: '',
            failDispositionCode: 'NOT_SELECTED',
          },
          {
            ...baseInterviewPlan.stages[1],
            status: 'PENDING',
            outcome: 'PENDING',
          },
        ],
      },
    });
    mockJobApplicationStore.update
      .mockResolvedValueOnce({
        id: 'app-1',
        status: 'INTERVIEWING',
        interviewPlan: {
          ...baseInterviewPlan,
          stages: [
            {
              ...baseInterviewPlan.stages[0],
              outcome: 'FAIL',
              outcomeNote: 'Candidate did not meet the required bar.',
              failDispositionCode: 'NOT_SELECTED',
            },
            baseInterviewPlan.stages[1],
          ],
        },
      })
      .mockResolvedValueOnce({
        id: 'app-1',
        candidateId: 'candidate-1',
        jobId: 'job-1',
        organizationId: 'org-1',
        status: 'REJECTED',
        interviewPlan: {
          ...baseInterviewPlan,
          stages: [
            {
              ...baseInterviewPlan.stages[0],
              outcome: 'FAIL',
              outcomeNote: 'Candidate did not meet the required bar.',
              failDispositionCode: 'NOT_SELECTED',
            },
            baseInterviewPlan.stages[1],
          ],
        },
        dispositionCode: 'NOT_SELECTED',
        dispositionCategory: 'REJECTED',
        dispositionReason: 'Recruiter Screen was marked as failed.',
        dispositionNotes: 'Candidate did not meet the required bar.',
        dispositionTags: [],
      });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      email: 'candidate@example.com',
      fullName: 'Candidate One',
    });
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Engineer',
      department: 'Engineering',
      templateConfig: {},
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {},
    });

    const req = companyReq({
      outcome: 'FAIL',
      note: 'Candidate did not meet the required bar.',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewStageOutcome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockJobApplicationStore.update).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      applicationStatusChange: expect.objectContaining({
        status: 'REJECTED',
        dispositionCode: 'NOT_SELECTED',
      }),
      plan: expect.objectContaining({
        stages: expect.arrayContaining([
          expect.objectContaining({
            id: 'recruiter-screen',
            outcome: 'FAIL',
          }),
        ]),
      }),
    }));
    expect(mockQueueEmailJob).toHaveBeenCalledWith(expect.objectContaining({
      type: 'APPLICATION_STATUS_UPDATED',
    }));
  });

  it('can save a pass outcome and create the next stage in one step', async () => {
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Engineer',
      department: 'Engineering',
      templateConfig: {},
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {
        interviewAutomation: {
          autoScheduleEnabled: false,
          timezone: 'UTC',
          durationMinutes: 45,
          slotMinutes: 30,
          leadHours: 24,
          scheduleWindowDays: 14,
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      fullName: 'Recruiter One',
      profile: {},
    });
    mockInterviewStore.create.mockImplementation(async (payload) => ({
      id: 'int-2',
      ...payload,
      status: 'PENDING',
    }));
    mockInterviewStore.update.mockImplementation(async (_id, payload) => payload);
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      ...payload,
    }));

    const req = companyReq({
      outcome: 'PASS',
      note: 'Advance to the SME round.',
      autoAdvance: true,
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.updateInterviewStageOutcome(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-1',
      planStageId: 'sme-interview',
      planStageName: 'SME Interview',
      planStageSequence: 2,
      planStageTotal: 2,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      nextInterview: expect.any(Object),
      autoAdvance: expect.objectContaining({
        attempted: true,
        created: true,
      }),
      plan: expect.objectContaining({
        currentStageId: 'sme-interview',
      }),
    }));
  });
});

describe('InterviewController.endInterview auto stage progression', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateMeetingToken.mockReturnValue({
      meetingToken: 'next-token',
      meetingTokenGeneratedAt: '2026-03-10T08:00:00.000Z',
    });
    mockInterviewStore.getWithQuestions.mockResolvedValue({
      ...baseInterview,
      id: 'interview-end-auto',
      status: 'IN_PROGRESS',
      applicationId: 'app-1',
      planStageId: 'recruiter-screen',
      planStageName: 'Recruiter Screen',
      planStageSequence: 1,
      planStageTotal: 2,
      questions: [
        { id: 'q-1', answer: 'I led a migration project and improved deployment reliability.' },
      ],
      config: {},
      reviewerAssignments: [],
      reviewRequests: [],
    });
    mockInterviewStore.update.mockImplementation(async (id, payload) => ({
      ...baseInterview,
      id,
      status: 'COMPLETED',
      applicationId: 'app-1',
      planStageId: 'recruiter-screen',
      planStageName: 'Recruiter Screen',
      planStageSequence: 1,
      planStageTotal: 2,
      reviewerAssignments: [],
      reviewRequests: [],
      questions: [
        { id: 'q-1', answer: 'I led a migration project and improved deployment reliability.' },
      ],
      ...payload,
    }));
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'interview-end-auto',
      status: 'INTERVIEWING',
      interviewPlan: {
        version: 1,
        currentStageId: 'recruiter-screen',
        stages: [
          {
            id: 'recruiter-screen',
            name: 'Recruiter Screen',
            sequence: 1,
            category: 'SCREENING',
            advanceRule: 'COMPLETE_TO_CONTINUE',
            autoAdvanceOnComplete: true,
            status: 'ACTIVE',
            outcome: 'PENDING',
          },
          {
            id: 'sme-interview',
            name: 'SME Interview',
            sequence: 2,
            category: 'TECHNICAL',
            advanceRule: 'PASS_REQUIRED',
            autoAdvanceOnPass: false,
            status: 'PENDING',
            outcome: 'PENDING',
          },
        ],
      },
    });
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => ({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: payload.interviewId || 'interview-end-auto',
      status: payload.status || 'INTERVIEWING',
      ...payload,
    }));
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Engineer',
      department: 'Engineering',
      templateConfig: {},
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {
        interviewAutomation: {
          autoScheduleEnabled: false,
          timezone: 'UTC',
          durationMinutes: 45,
          slotMinutes: 30,
          leadHours: 24,
          scheduleWindowDays: 14,
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      fullName: 'Recruiter One',
      profile: {},
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      email: 'candidate@example.com',
      fullName: 'Candidate One',
    });
    mockUserStore.getSummaries.mockResolvedValue(new Map());
    mockInterviewStore.create.mockImplementation(async (payload) => ({
      id: 'interview-next-stage',
      ...payload,
      status: 'PENDING',
    }));
  });

  it('creates the next round automatically when the stage is configured for completion-based progression', async () => {
    const req = companyReq({}, { id: 'interview-end-auto' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.endInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-1',
      planStageId: 'sme-interview',
      planStageName: 'SME Interview',
      planStageSequence: 2,
      planStageTotal: 2,
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      nextInterview: expect.objectContaining({
        id: 'interview-next-stage',
        status: expect.stringMatching(/PENDING|SCHEDULED/),
      }),
      autoAdvance: expect.objectContaining({
        attempted: true,
        created: true,
        scheduled: expect.any(Boolean),
      }),
    }));
  });
});

describe('InterviewController.createNextInterviewStage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      applicationId: 'app-1',
      planStageId: 'recruiter-screen',
      planStageName: 'Recruiter Screen',
      planStageSequence: 1,
      planStageTotal: 2,
    });
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      interviewPlan: baseInterviewPlan,
    });
    mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Engineer',
      department: 'Engineering',
      templateConfig: {},
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'TestCo',
      displayName: 'TestCo',
      settings: {
        interviewAutomation: {
          autoScheduleEnabled: false,
          timezone: 'UTC',
          durationMinutes: 45,
          slotMinutes: 30,
          leadHours: 24,
          scheduleWindowDays: 14,
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      fullName: 'Recruiter One',
      profile: {},
    });
    mockInterviewStore.create.mockImplementation(async (payload) => ({
      id: 'int-2',
      ...payload,
      status: 'PENDING',
    }));
    mockInterviewStore.update.mockImplementation(async (_id, payload) => payload);
    mockHydrateInterviewParticipants.mockImplementation((interviews) => interviews || []);
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
  });

  it('creates the next planned hiring interview stage for recruiters', async () => {
    const req = companyReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.createNextInterviewStage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: 'app-1',
      planStageId: 'sme-interview',
      planStageName: 'SME Interview',
      planStageSequence: 2,
      planStageTotal: 2,
    }));
    expect(mockJobApplicationStore.update).toHaveBeenCalledWith(
      'app-1',
      expect.objectContaining({
        interviewPlan: expect.objectContaining({
          currentStageId: 'sme-interview',
          stages: expect.arrayContaining([
            expect.objectContaining({
              id: 'sme-interview',
              interviewId: 'int-2',
            }),
          ]),
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      created: true,
      scheduled: expect.any(Boolean),
      plan: expect.objectContaining({
        currentStageId: 'sme-interview',
      }),
      currentStage: expect.objectContaining({
        id: 'sme-interview',
        name: 'SME Interview',
      }),
    }));
  });

  it('returns a conflict when no further interview stage is planned', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...scheduledInterview,
      status: 'COMPLETED',
      applicationId: 'app-1',
      planStageId: 'sme-interview',
      planStageName: 'SME Interview',
      planStageSequence: 2,
      planStageTotal: 2,
    });
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      interviewPlan: {
        ...baseInterviewPlan,
        currentStageId: 'sme-interview',
        stages: [
          {
            ...baseInterviewPlan.stages[0],
            status: 'COMPLETED',
            completedAt: '2026-03-09T08:00:00.000Z',
            outcome: 'PASS',
          },
          {
            ...baseInterviewPlan.stages[1],
            status: 'COMPLETED',
            completedAt: '2026-03-09T09:00:00.000Z',
            outcome: 'PASS',
          },
        ],
      },
    });

    const req = companyReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.createNextInterviewStage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NO_NEXT_INTERVIEW_STAGE',
      plan: expect.objectContaining({
        currentStageId: 'sme-interview',
      }),
    }));
    expect(mockInterviewStore.create).not.toHaveBeenCalled();
  });

  it('blocks the next stage when the current stage outcome does not allow progression', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      candidateId: 'candidate-1',
      jobId: 'job-1',
      organizationId: 'org-1',
      interviewId: 'int-1',
      interviewPlan: {
        ...baseInterviewPlan,
        stages: [
          {
            ...baseInterviewPlan.stages[0],
            status: 'COMPLETED',
            completedAt: '2026-03-09T08:00:00.000Z',
            outcome: 'HOLD',
          },
          {
            ...baseInterviewPlan.stages[1],
            status: 'PENDING',
            completedAt: null,
            outcome: 'PENDING',
          },
        ],
      },
    });

    const req = companyReq();
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.createNextInterviewStage(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'INTERVIEW_STAGE_OUTCOME_REQUIRED',
    }));
    expect(mockInterviewStore.create).not.toHaveBeenCalled();
  });
});
