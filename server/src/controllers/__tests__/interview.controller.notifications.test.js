import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockInterviewStore = {
  getById: jest.fn(),
  getWithQuestions: jest.fn(),
  update: jest.fn(),
  listByCompany: jest.fn(),
  listByOrganization: jest.fn(),
};

const mockActivityLogStore = {
  record: jest.fn(),
};

const mockInvitationStore = {
  getById: jest.fn(),
};

const mockJobApplicationStore = {
  update: jest.fn(),
};

const mockJobStore = {
  getById: jest.fn(),
};

const mockOrganizationStore = {
  getById: jest.fn(),
};

const mockNotificationStore = {
  create: jest.fn(),
};

const mockSystemSettingsStore = {
  get: jest.fn(),
};

const mockUserStore = {
  getById: jest.fn(),
  getSummary: jest.fn(),
  getSummaries: jest.fn(),
};

const mockRecordRealtimeEvent = jest.fn();
const mockPublishAdminRealtimeUpdate = jest.fn();
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();
const mockGenerateInterviewSummary = jest.fn();
const mockOnFirstInterviewInternal = jest.fn();
const mockSendInterviewScheduled = jest.fn();
const mockSendInterviewRescheduled = jest.fn();
const mockSendInterviewCancelled = jest.fn();
const mockSendInterviewCompletedUnderReview = jest.fn();

jest.unstable_mockModule('../../config/firebase.js', () => ({
  firestore: {
    collection: () => ({
      doc: () => ({
        get: async () => ({ exists: false }),
      }),
    }),
    settings: () => undefined,
  },
  realtimeDb: {
    ref: () => ({
      push: async () => undefined,
      set: async () => undefined,
    }),
  },
  auth: {},
  storage: {},
  default: {
    firestore: () => ({
      collection: () => ({
        doc: () => ({
          get: async () => ({ exists: false }),
        }),
      }),
    }),
  },
}));

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  activityLogStore: mockActivityLogStore,
  hydrateInterviewParticipants: jest.fn((interviews) => interviews || []),
  interviewStore: mockInterviewStore,
  invitationStore: mockInvitationStore,
  jobApplicationStore: mockJobApplicationStore,
  jobStore: mockJobStore,
  organizationStore: mockOrganizationStore,
  notificationStore: mockNotificationStore,
  publishAdminRealtimeUpdate: mockPublishAdminRealtimeUpdate,
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  recordRealtimeEvent: mockRecordRealtimeEvent,
  systemSettingsStore: mockSystemSettingsStore,
  userStore: mockUserStore,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailNotifications: {
    sendInterviewScheduled: mockSendInterviewScheduled,
    sendInterviewRescheduled: mockSendInterviewRescheduled,
    sendInterviewCancelled: mockSendInterviewCancelled,
    sendInterviewCompletedUnderReview: mockSendInterviewCompletedUnderReview,
  },
}));

jest.unstable_mockModule('../../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
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

const buildCompanyReq = (body = {}) => ({
  params: { id: 'int-1' },
  body,
  user: {
    id: 'admin-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1', status: 'APPROVED' },
      membership: { role: 'ADMIN' },
    },
  },
});

const baseInterview = {
  id: 'int-1',
  mode: 'HIRING',
  status: 'SCHEDULED',
  candidateId: 'candidate-1',
  companyId: 'company-1',
  organizationId: 'org-1',
  jobId: 'job-1',
  jobRole: 'Senior Frontend Engineer',
  timezone: 'UTC',
  duration: 45,
  meetingLink: null,
};

const futureIso = (hours = 48) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

describe('InterviewController lifecycle email queuing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishAdminRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockInvitationStore.getById.mockResolvedValue(null);
    mockJobApplicationStore.update.mockResolvedValue(undefined);
    mockOnFirstInterviewInternal.mockResolvedValue({ success: true });
    mockInterviewStore.listByCompany.mockResolvedValue([]);
    mockInterviewStore.listByOrganization.mockResolvedValue([]);

    mockUserStore.getById.mockResolvedValue({
      id: 'admin-1',
      accountType: 'COMPANY',
      timezone: 'UTC',
      interviewAvailability: null,
    });
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      email: 'candidate@example.com',
      fullName: 'Candidate One',
    });
    mockUserStore.getSummaries.mockResolvedValue(
      new Map([
        ['candidate-1', { id: 'candidate-1', fullName: 'Candidate One' }],
        ['company-1', { id: 'company-1', fullName: 'Recruiter One' }],
      ]),
    );
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Frontend Engineer',
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
          timezone: 'UTC',
          leadHours: 1,
          slotMinutes: 30,
          durationMinutes: 30,
          bufferMinutes: 0,
          scheduleWindowDays: 365,
          businessHoursStart: '00:00',
          businessHoursEnd: '23:59',
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          maxInterviewsPerDay: 100,
          conflictScope: 'RECRUITER',
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queues INTERVIEW_SCHEDULED email on scheduling', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      status: 'SCHEDULED',
      scheduledFor: null,
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
      id: 'int-1',
    }));

    const req = buildCompanyReq({
      scheduledFor: futureIso(48),
      timezone: 'Asia/Colombo',
      meetingLink: 'https://meet.example.com/abc',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.scheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    const queued = mockQueueEmailJob.mock.calls[0][0];
    expect(queued.type).toBe('INTERVIEW_SCHEDULED');
    await queued.handler();
    expect(mockSendInterviewScheduled).toHaveBeenCalledTimes(1);
  });

  it('queues INTERVIEW_RESCHEDULED email on rescheduling', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      status: 'SCHEDULED',
      scheduledFor: futureIso(48),
      meetingLink: 'https://meet.example.com/old',
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
      id: 'int-1',
    }));

    const req = buildCompanyReq({
      scheduledFor: futureIso(72),
      timezone: 'Asia/Colombo',
      meetingLink: 'https://meet.example.com/new',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    const queued = mockQueueEmailJob.mock.calls[0][0];
    expect(queued.type).toBe('INTERVIEW_RESCHEDULED');
    await queued.handler();
    expect(mockSendInterviewRescheduled).toHaveBeenCalledTimes(1);
  });

  it('queues INTERVIEW_CANCELLED email on cancellation', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      status: 'SCHEDULED',
      scheduledFor: futureIso(48),
      meetingLink: 'https://meet.example.com/abc',
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
      id: 'int-1',
    }));

    const req = buildCompanyReq({
      reason: 'Hiring plan changed',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.cancelInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    const queued = mockQueueEmailJob.mock.calls[0][0];
    expect(queued.type).toBe('INTERVIEW_CANCELLED');
    await queued.handler();
    expect(mockSendInterviewCancelled).toHaveBeenCalledTimes(1);
  });

  it('queues INTERVIEW_COMPLETED_UNDER_REVIEW email when interview ends', async () => {
    mockInterviewStore.getWithQuestions.mockResolvedValue({
      ...baseInterview,
      status: 'IN_PROGRESS',
      invitationId: null,
      questions: [{ id: 'q-1', answer: 'Sample answer' }],
      config: {},
    });
    mockGenerateInterviewSummary.mockResolvedValue({
      overallScore: 84,
      readinessLevel: 'READY',
      strengths: [],
      improvements: [],
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      status: 'COMPLETED',
      questions: [{ id: 'q-1', answer: 'Sample answer' }],
      ...payload,
      id: 'int-1',
    }));

    const req = {
      params: { id: 'int-1' },
      user: {
        id: 'company-1',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1', status: 'APPROVED' },
          membership: { role: 'ADMIN' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.endInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    const queued = mockQueueEmailJob.mock.calls[0][0];
    expect(queued.type).toBe('INTERVIEW_COMPLETED_UNDER_REVIEW');
    await queued.handler();
    expect(mockSendInterviewCompletedUnderReview).toHaveBeenCalledTimes(1);
  });
});
