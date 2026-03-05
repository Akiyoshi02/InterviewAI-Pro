import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockInterviewStore = {
  getById: jest.fn(),
  update: jest.fn(),
  listByCompany: jest.fn(),
  listByOrganization: jest.fn(),
};

const mockActivityLogStore = {
  record: jest.fn(),
};

const mockNotificationStore = {
  create: jest.fn(),
};

const mockJobStore = {
  getById: jest.fn(),
};

const mockOrganizationStore = {
  getById: jest.fn(),
};

const mockUserStore = {
  getById: jest.fn(),
  getSummary: jest.fn(),
  getSummaries: jest.fn(),
};

const mockRecordRealtimeEvent = jest.fn();
const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();
const mockSendInterviewRescheduled = jest.fn();

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
  invitationStore: { getById: jest.fn() },
  jobApplicationStore: { update: jest.fn() },
  jobStore: mockJobStore,
  organizationStore: mockOrganizationStore,
  notificationStore: mockNotificationStore,
  publishAdminRealtimeUpdate: jest.fn(),
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  recordRealtimeEvent: mockRecordRealtimeEvent,
  systemSettingsStore: { get: jest.fn() },
  userStore: mockUserStore,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailNotifications: {
    sendInterviewRescheduled: mockSendInterviewRescheduled,
  },
}));

jest.unstable_mockModule('../../services/backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

jest.unstable_mockModule('../../services/llm.service.js', () => ({
  LLMService: {
    generateInterviewSummary: jest.fn(),
  },
}));

jest.unstable_mockModule('../referral.controller.js', () => ({
  ReferralController: {
    onFirstInterviewInternal: jest.fn(),
  },
}));

const { InterviewController } = await import('../interview.controller.js');

const createResponse = () => {
  const response = {};
  response.status = jest.fn().mockReturnValue(response);
  response.json = jest.fn().mockReturnValue(response);
  return response;
};

const buildCandidateReq = (body = {}) => ({
  params: { id: 'int-1' },
  body,
  user: {
    id: 'candidate-1',
    accountType: 'CANDIDATE',
  },
});

const buildCompanyReq = (body = {}, requestId = 'request-1') => ({
  params: { id: 'int-1', requestId },
  body,
  user: {
    id: 'recruiter-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1', status: 'APPROVED' },
      membership: { role: 'ADMIN' },
    },
  },
});

const futureIso = (hours = 24) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

const baseInterview = {
  id: 'int-1',
  mode: 'HIRING',
  status: 'SCHEDULED',
  candidateId: 'candidate-1',
  companyId: 'recruiter-1',
  organizationId: 'org-1',
  jobId: 'job-1',
  jobRole: 'Data Analyst',
  scheduledFor: futureIso(48),
  timezone: 'UTC',
  meetingLink: 'https://meet.example.com/session',
  rescheduleRequests: [],
};

describe('InterviewController reschedule request flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockNotificationStore.create.mockResolvedValue({ id: 'notif-1' });
    mockRecordRealtimeEvent.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockInterviewStore.listByCompany.mockResolvedValue([]);
    mockInterviewStore.listByOrganization.mockResolvedValue([]);
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Data Analyst',
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
          scheduleWindowDays: 45,
          businessHoursStart: '00:00',
          businessHoursEnd: '23:59',
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          maxInterviewsPerDay: 20,
          conflictScope: 'RECRUITER',
        },
      },
    });
    mockUserStore.getById.mockResolvedValue({
      id: 'recruiter-1',
      accountType: 'COMPANY',
      timezone: 'UTC',
      interviewAvailability: null,
    });
    mockUserStore.getSummaries.mockResolvedValue(
      new Map([
        ['candidate-1', { id: 'candidate-1', fullName: 'Candidate One', email: 'candidate@example.com' }],
        ['recruiter-1', { id: 'recruiter-1', fullName: 'Recruiter One', email: 'recruiter@example.com' }],
      ]),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows candidate to submit a valid reschedule request', async () => {
    mockInterviewStore.getById.mockResolvedValue(baseInterview);
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
    }));

    const req = buildCandidateReq({
      reason: 'I have an overlapping university exam and need a different slot.',
      preferredSlots: [futureIso(72)],
      timezone: 'Asia/Colombo',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.requestInterviewReschedule(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).toHaveBeenCalledTimes(1);
    const updatePayload = mockInterviewStore.update.mock.calls[0][1];
    expect(Array.isArray(updatePayload.rescheduleRequests)).toBe(true);
    expect(updatePayload.rescheduleRequests[0].status).toBe('PENDING');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  it('rejects candidate request when another reschedule request is pending', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [
        {
          id: 'request-1',
          status: 'PENDING',
          reason: 'Need to change slot',
          requestedAt: futureIso(-1),
          requestedBy: 'candidate-1',
        },
      ],
    });

    const req = buildCandidateReq({
      reason: 'Need to move this interview because of an emergency.',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.requestInterviewReschedule(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('lets company reject a pending reschedule request', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [
        {
          id: 'request-1',
          status: 'PENDING',
          reason: 'Need to move to another day.',
          requestedAt: futureIso(-8),
          requestedBy: 'candidate-1',
        },
      ],
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
    }));

    const req = buildCompanyReq({ reason: 'Current panel availability is fixed.' });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rejectInterviewRescheduleRequest(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).toHaveBeenCalledTimes(1);
    const updatePayload = mockInterviewStore.update.mock.calls[0][1];
    expect(updatePayload.rescheduleRequests[0].status).toBe('REJECTED');
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  it('auto-approves pending request when company reschedules', async () => {
    const preferredSlot = futureIso(96);
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [
        {
          id: 'request-1',
          status: 'PENDING',
          reason: 'Need to move interview time.',
          requestedAt: futureIso(-10),
          requestedBy: 'candidate-1',
          preferredSlots: [preferredSlot],
        },
      ],
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
    }));

    const req = buildCompanyReq({
      strategy: 'PREFERRED_FIRST',
      timezone: 'Asia/Colombo',
      meetingLink: 'https://meet.example.com/new',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).toHaveBeenCalledTimes(1);
    const updatePayload = mockInterviewStore.update.mock.calls[0][1];
    expect(updatePayload.rescheduleRequests[0].status).toBe('APPROVED');
    expect(updatePayload.scheduledFor).toBe(new Date(preferredSlot).toISOString());
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
  });

  it('rejects manual reschedule when slot is outside recruiter availability', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [],
    });
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseInterview,
      ...payload,
    }));
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
          timezone: 'UTC',
          leadHours: 1,
          slotMinutes: 30,
          durationMinutes: 30,
          bufferMinutes: 0,
          scheduleWindowDays: 30,
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          workingDays: [0, 1, 2, 3, 4, 5, 6],
          maxInterviewsPerDay: 20,
          conflictScope: 'RECRUITER',
        },
      },
    });

    const tomorrowLateNight = new Date(Date.now() + 36 * 60 * 60 * 1000);
    tomorrowLateNight.setUTCHours(23, 0, 0, 0);

    const req = buildCompanyReq({
      strategy: 'MANUAL',
      scheduledFor: tomorrowLateNight.toISOString(),
      timezone: 'UTC',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SLOT_OUTSIDE_AVAILABILITY',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });
});
