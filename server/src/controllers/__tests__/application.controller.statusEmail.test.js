import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockJobApplicationStore = {
  getById: jest.fn(),
  update: jest.fn(),
};

const mockJobStore = {
  getById: jest.fn(),
};

const mockInterviewStore = {
  getById: jest.fn(),
  listByJob: jest.fn(),
  listByCompany: jest.fn(),
  listByOrganization: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

const mockUserStore = {
  getSummary: jest.fn(),
};

const mockActivityLogStore = {
  record: jest.fn(),
};

const mockOrganizationStore = {
  getById: jest.fn(),
};

const mockPublishOrganizationRealtimeUpdate = jest.fn();
const mockPublishCandidateRealtimeUpdate = jest.fn();
const mockQueueEmailJob = jest.fn();
const mockSendApplicationStatusUpdated = jest.fn();
const mockSendInterviewScheduled = jest.fn();

const baseScheduledInterview = {
  id: 'int-1',
  mode: 'HIRING',
  status: 'SCHEDULED',
  candidateId: 'candidate-1',
  organizationId: 'org-1',
  jobId: 'job-1',
  scheduledFor: '2026-03-10T09:00:00.000Z',
  timezone: 'UTC',
  meetingLink: 'https://app.example.com/interview-lobby/int-1',
};

jest.unstable_mockModule('../../services/firebaseData.service.js', () => ({
  jobApplicationStore: mockJobApplicationStore,
  jobStore: mockJobStore,
  interviewStore: mockInterviewStore,
  userStore: mockUserStore,
  activityLogStore: mockActivityLogStore,
  organizationStore: mockOrganizationStore,
  isJobCurrentlyPublic: jest.fn(() => true),
  publishOrganizationRealtimeUpdate: mockPublishOrganizationRealtimeUpdate,
  publishCandidateRealtimeUpdate: mockPublishCandidateRealtimeUpdate,
}));

jest.unstable_mockModule('../../services/email.service.js', () => ({
  emailNotifications: {
    sendApplicationStatusUpdated: mockSendApplicationStatusUpdated,
    sendInterviewScheduled: mockSendInterviewScheduled,
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

const buildReq = (status = 'SCREENING') => ({
  params: { id: 'app-1' },
  body: { status },
  user: {
    id: 'company-admin-1',
    organizationContext: {
      organization: { id: 'org-1' },
      membership: { role: 'ADMIN' },
    },
  },
});

describe('ApplicationController.updateApplicationStatus email queuing', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockActivityLogStore.record.mockResolvedValue(undefined);
    mockPublishOrganizationRealtimeUpdate.mockResolvedValue(undefined);
    mockPublishCandidateRealtimeUpdate.mockResolvedValue(undefined);
    mockInterviewStore.getById.mockResolvedValue(null);
    mockInterviewStore.listByJob.mockResolvedValue([]);
    mockInterviewStore.listByCompany.mockResolvedValue([]);
    mockInterviewStore.listByOrganization.mockResolvedValue([]);
    mockInterviewStore.create.mockResolvedValue(baseScheduledInterview);
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      ...baseScheduledInterview,
      id: 'int-1',
      ...payload,
    }));
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      email: 'candidate@example.com',
      fullName: 'Candidate One',
    });
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Frontend Engineer',
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('queues status email when recruiter confirms a status transition', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SUBMITTED',
      statusHistory: [],
    });
    mockJobApplicationStore.update.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      dispositionReason: null,
      statusHistory: [],
    });

    const req = buildReq('SCREENING');
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);

    const queued = mockQueueEmailJob.mock.calls[0][0];
    expect(queued.type).toBe('APPLICATION_STATUS_UPDATED');
    expect(queued.payload).toEqual(expect.objectContaining({
      applicationId: 'app-1',
      candidateId: 'candidate-1',
      recipient: 'candidate@example.com',
      status: 'SCREENING',
    }));

    await queued.handler();
    expect(mockSendApplicationStatusUpdated).toHaveBeenCalledTimes(1);
    const statusMessage = mockSendApplicationStatusUpdated.mock.calls[0][4];
    expect(String(statusMessage).toLowerCase()).toContain('screening');
  });

  it('does not queue status email when recruiter confirms the same status (no transition)', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      statusHistory: [],
    });
    mockJobApplicationStore.update.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      dispositionReason: null,
      statusHistory: [],
    });

    const req = buildReq('SCREENING');
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
    }));
    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('auto-creates and schedules an interview when status changes to interviewing', async () => {
    const submitted = {
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      statusHistory: [],
    };
    const interviewing = {
      ...submitted,
      status: 'INTERVIEWING',
      dispositionReason: null,
      statusHistory: [],
    };

    mockJobApplicationStore.getById.mockResolvedValue(submitted);
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => {
      if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
        return interviewing;
      }
      return {
        ...interviewing,
        ...payload,
      };
    });
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      experienceLevel: 'SENIOR',
      department: 'Engineering',
      skills: ['React', 'TypeScript'],
      templateConfig: {
        interviewTypes: ['BEHAVIORAL', 'TECHNICAL'],
        duration: 45,
      },
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
          leadHours: 24,
          slotMinutes: 30,
          timezone: 'Asia/Colombo',
        },
      },
    });

    const req = buildReq('INTERVIEWING');
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.create).toHaveBeenCalledTimes(1);
    expect(mockQueueEmailJob).toHaveBeenCalledTimes(2);
    const queueTypes = mockQueueEmailJob.mock.calls.map((call) => call[0]?.type);
    expect(queueTypes).toContain('APPLICATION_STATUS_UPDATED');
    expect(queueTypes).toContain('INTERVIEW_SCHEDULED');
  });

  it('skips conflicting slots and picks the next valid automation slot', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-05T09:05:00.000Z'));
    try {

      const submitted = {
        id: 'app-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        organizationId: 'org-1',
        status: 'SCREENING',
        statusHistory: [],
      };
      const interviewing = {
        ...submitted,
        status: 'INTERVIEWING',
        dispositionReason: null,
        statusHistory: [],
      };

      mockJobApplicationStore.getById.mockResolvedValue(submitted);
      mockJobApplicationStore.update.mockImplementation(async (_id, payload) => {
        if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
          return interviewing;
        }
        return {
          ...interviewing,
          ...payload,
        };
      });
      mockInterviewStore.create.mockImplementation(async (payload) => ({
        id: 'int-1',
        ...payload,
      }));
      mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
        id: 'int-1',
        ...payload,
      }));
      mockInterviewStore.listByCompany.mockResolvedValue([
        {
          id: 'int-existing',
          status: 'SCHEDULED',
          scheduledFor: '2026-03-05T10:30:00.000Z',
          duration: 30,
        },
      ]);

      mockJobStore.getById.mockResolvedValue({
        id: 'job-1',
        title: 'Senior Frontend Engineer',
        experienceLevel: 'SENIOR',
        department: 'Engineering',
        skills: ['React', 'TypeScript'],
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
            bufferMinutes: 15,
            scheduleWindowDays: 2,
            businessHoursStart: '09:00',
            businessHoursEnd: '17:00',
            workingDays: [1, 2, 3, 4, 5],
            maxInterviewsPerDay: 8,
            conflictScope: 'RECRUITER',
          },
        },
      });

      const req = buildReq('INTERVIEWING');
      const res = createResponse();
      const next = jest.fn();

      await ApplicationController.updateApplicationStatus(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(mockInterviewStore.update).toHaveBeenCalledWith(
        'int-1',
        expect.objectContaining({
          status: 'SCHEDULED',
          scheduledFor: '2026-03-05T11:30:00.000Z',
        }),
      );

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        interviewAutomation: expect.objectContaining({
          mode: 'AUTO',
          scheduled: true,
          slotFound: true,
          strategy: 'CONSTRAINT_BASED_V1',
        }),
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it('respects manual scheduling mode override when moving to interviewing', async () => {
    const submitted = {
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      statusHistory: [],
    };
    const interviewing = {
      ...submitted,
      status: 'INTERVIEWING',
      dispositionReason: null,
      statusHistory: [],
    };

    mockJobApplicationStore.getById.mockResolvedValue(submitted);
    mockJobApplicationStore.update.mockImplementation(async (_id, payload) => {
      if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
        return interviewing;
      }
      return {
        ...interviewing,
        ...payload,
      };
    });
    mockInterviewStore.create.mockImplementation(async (payload) => ({
      id: 'int-1',
      ...payload,
    }));
    mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
      id: 'int-1',
      ...payload,
    }));
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      experienceLevel: 'SENIOR',
      department: 'Engineering',
      skills: ['React', 'TypeScript'],
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: true,
        },
      },
    });

    const req = buildReq('INTERVIEWING');
    req.body.interviewSchedulingMode = 'MANUAL';
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockInterviewStore.create).toHaveBeenCalledTimes(1);
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      status: 'PENDING',
      scheduledFor: null,
      scheduleStatus: null,
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({ status: 'SCHEDULED' }),
    );

    const queueTypes = mockQueueEmailJob.mock.calls.map((call) => call[0]?.type);
    expect(queueTypes).toContain('APPLICATION_STATUS_UPDATED');
    expect(queueTypes).not.toContain('INTERVIEW_SCHEDULED');

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      interviewAutomation: expect.objectContaining({
        mode: 'MANUAL',
        scheduled: false,
      }),
    }));
  });
});
