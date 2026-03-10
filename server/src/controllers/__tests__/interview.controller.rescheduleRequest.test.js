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
const mockJobApplicationStore = {
  getById: jest.fn(),
  checkDuplicate: jest.fn(),
  update: jest.fn(),
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

const buildCompanyReq = (body = {}, requestId = 'request-1', userOverrides = {}) => {
  const baseUser = {
    id: 'recruiter-1',
    accountType: 'COMPANY',
    organizationContext: {
      organization: { id: 'org-1', status: 'APPROVED' },
      membership: { role: 'ADMIN' },
    },
  };
  return {
    params: { id: 'int-1', requestId },
    body,
    user: {
      ...baseUser,
      ...userOverrides,
      organizationContext: userOverrides.organizationContext || baseUser.organizationContext,
    },
  };
};

const futureIso = (hours = 24) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
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
    mockJobApplicationStore.getById.mockResolvedValue(null);
    mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
    mockJobApplicationStore.update.mockResolvedValue(undefined);
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

  it('rejects candidate request when a preferred slot is in the past', async () => {
    mockInterviewStore.getById.mockResolvedValue(baseInterview);

    const req = buildCandidateReq({
      reason: 'I have an overlapping university exam and need a different slot.',
      preferredSlots: [futureIso(-2)],
      timezone: 'Asia/Colombo',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.requestInterviewReschedule(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'PREFERRED_SLOT_IN_PAST',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
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

  it('uses the assigned recruiter availability instead of the acting admin when rescheduling', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [],
    });
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

    const req = buildCompanyReq({
      strategy: 'MANUAL',
      scheduledFor: futureWeekdayIso(2, 12, 0),
      timezone: 'UTC',
    }, 'request-1', {
      id: 'admin-1',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

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

  it('fails closed when organization scheduling settings cannot be loaded during reschedule', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [],
    });
    mockOrganizationStore.getById.mockRejectedValue(new Error('organization store unavailable'));

    const req = buildCompanyReq({
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

  it('rejects manual reschedule when the selected slot is in the past', async () => {
    mockInterviewStore.getById.mockResolvedValue({
      ...baseInterview,
      rescheduleRequests: [],
    });

    const pastDate = new Date(Date.now() - (2 * 60 * 60 * 1000)).toISOString();
    const req = buildCompanyReq({
      strategy: 'MANUAL',
      scheduledFor: pastDate,
      timezone: 'UTC',
    });
    const res = createResponse();
    const next = jest.fn();

    await InterviewController.rescheduleInterview(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'SLOT_IN_PAST',
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });
});
