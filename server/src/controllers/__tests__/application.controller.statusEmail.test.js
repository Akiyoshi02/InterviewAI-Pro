import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockJobApplicationStore = {
  getById: jest.fn(),
  checkDuplicate: jest.fn(),
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
  getById: jest.fn(),
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
  organizationMemberStore: mockOrganizationMemberStore,
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

describe('ApplicationController.getApplication scheduling preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'reviewer-1', role: 'REVIEWER', status: 'ACTIVE' },
      { userId: 'company-admin-1', role: 'ADMIN', status: 'ACTIVE' },
    ]);

    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'SCREENING',
      reviewedBy: 'reviewer-1',
    });
    mockJobStore.getById.mockResolvedValue({
      id: 'job-1',
      title: 'Senior Frontend Engineer',
      templateConfig: { duration: 45 },
    });
    mockInterviewStore.getById.mockResolvedValue(null);
    mockUserStore.getSummary.mockResolvedValue({
      id: 'candidate-1',
      fullName: 'Candidate One',
      email: 'candidate@example.com',
    });
    mockUserStore.getById.mockImplementation(async (id) => {
      if (id === 'reviewer-1') {
        return {
          id: 'reviewer-1',
          accountType: 'COMPANY',
          fullName: 'Reviewer One',
          timezone: 'Asia/Colombo',
          profile: {
            timezone: 'Asia/Colombo',
            interviewAvailability: {
              timezone: 'Asia/Colombo',
              workingDays: [2, 4],
              businessHoursStart: '10:00',
              businessHoursEnd: '16:00',
              maxInterviewsPerDay: 4,
            },
          },
        };
      }
      return null;
    });
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      settings: {
        interviewAutomation: {
          timezone: 'Asia/Colombo',
          leadHours: 6,
          slotMinutes: 30,
          scheduleWindowDays: 10,
          durationMinutes: 30,
          businessHoursStart: '09:00',
          businessHoursEnd: '17:00',
          workingDays: [1, 2, 3, 4, 5],
          conflictScope: 'RECRUITER',
        },
      },
    });
  });

  it('returns recruiter-aware scheduling preview data for company users', async () => {
    const req = {
      params: { id: 'app-1' },
      user: {
        id: 'reviewer-1',
        accountType: 'COMPANY',
        organizationContext: {
          organization: { id: 'org-1' },
          membership: { role: 'ADMIN' },
        },
      },
    };
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.getApplication(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        interviewSchedulingPreview: expect.objectContaining({
          timezone: 'Asia/Colombo',
          leadHours: 6,
          slotMinutes: 30,
          scheduleWindowDays: 10,
          workingDays: [2, 4],
          businessHoursStartMinutes: 10 * 60,
          businessHoursEndMinutes: 16 * 60,
          availabilitySource: 'RECRUITER',
          assignedRecruiterId: 'reviewer-1',
          assignedRecruiterName: 'Reviewer One',
        }),
        interviewSchedulingPreviewError: null,
      }),
    }));
  });
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

describe('ApplicationController.updateApplicationStatus email queuing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobApplicationStore.checkDuplicate.mockResolvedValue(null);
    mockOrganizationMemberStore.listByOrganization.mockResolvedValue([
      { userId: 'reviewer-1', role: 'REVIEWER', status: 'ACTIVE' },
      { userId: 'company-admin-1', role: 'ADMIN', status: 'ACTIVE' },
    ]);

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
    mockUserStore.getById.mockImplementation(async (id) => ({
      id,
      accountType: 'COMPANY',
      timezone: 'UTC',
      profile: {
        timezone: 'UTC',
        interviewAvailability: null,
      },
    }));
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
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      application: expect.objectContaining({
        status: 'INTERVIEWING',
        job: expect.objectContaining({
          title: 'Senior Frontend Engineer',
          isDeleted: false,
        }),
        organization: expect.objectContaining({
          name: 'Cynectex',
        }),
      }),
    }));
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

  it('persists reviewer assignments when moving a candidate to interviewing', async () => {
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
    mockOrganizationStore.getById.mockResolvedValue({
      id: 'org-1',
      name: 'Cynectex',
      displayName: 'Cynectex',
      settings: {
        interviewAutomation: {
          autoScheduleOnInterviewing: false,
        },
      },
    });

    const req = buildReq('INTERVIEWING');
    req.body.interviewSchedulingMode = 'MANUAL';
    req.body.reviewerAssignments = ['reviewer-1'];
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockOrganizationMemberStore.listByOrganization).toHaveBeenCalledWith('org-1');
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      planStageId: 'recruiter-screen',
      planStageName: 'Recruiter Screen',
      reviewerAssignments: [],
      reviewRequests: [],
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      application: expect.objectContaining({
        interviewPlan: expect.objectContaining({
          stages: expect.arrayContaining([
            expect.objectContaining({
              id: 'sme-interview',
              reviewerAssignments: ['reviewer-1'],
            }),
          ]),
        }),
      }),
    }));
  });

  it('uses the linked interview recruiter instead of the acting admin for automation availability', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-08T08:05:00.000Z'));
    try {
      const submitted = {
        id: 'app-1',
        jobId: 'job-1',
        candidateId: 'candidate-1',
        organizationId: 'org-1',
        status: 'SCREENING',
        statusHistory: [],
        interviewId: 'int-1',
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
      mockInterviewStore.getById.mockResolvedValue({
        id: 'int-1',
        mode: 'HIRING',
        status: 'PENDING',
        candidateId: 'candidate-1',
        companyId: 'assigned-recruiter-1',
        organizationId: 'org-1',
        jobId: 'job-1',
      });
      mockInterviewStore.update.mockImplementation(async (_id, payload) => ({
        id: 'int-1',
        companyId: 'assigned-recruiter-1',
        ...payload,
      }));
      mockUserStore.getById.mockImplementation(async (id) => {
        if (id === 'assigned-recruiter-1') {
          return {
            id,
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
        if (id === 'company-admin-1') {
          return {
            id,
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
            scheduleWindowDays: 7,
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
      expect(mockInterviewStore.listByCompany).toHaveBeenCalledWith('assigned-recruiter-1', { limit: 200 });
      expect(mockUserStore.getById).toHaveBeenCalledWith('assigned-recruiter-1');
      expect(mockInterviewStore.update).toHaveBeenCalledWith(
        'int-1',
        expect.objectContaining({
          scheduledFor: '2026-03-09T09:00:00.000Z',
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the interview pending and returns a warning when assigned recruiter availability cannot be loaded', async () => {
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
    mockUserStore.getById.mockRejectedValue(new Error('user store unavailable'));
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
          scheduleWindowDays: 7,
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
    expect(mockInterviewStore.create).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 'company-admin-1',
      status: 'PENDING',
      scheduledFor: null,
    }));
    expect(mockInterviewStore.update).not.toHaveBeenCalledWith(
      'int-1',
      expect.objectContaining({ status: 'SCHEDULED' }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      warning: 'Assigned recruiter availability could not be loaded. Interview was created without automatic scheduling.',
      interviewAutomation: expect.objectContaining({
        scheduled: false,
      }),
    }));
  });

  it('blocks moving an application to offer until the final interview round has a pass outcome', async () => {
    mockJobApplicationStore.getById.mockResolvedValue({
      id: 'app-1',
      jobId: 'job-1',
      candidateId: 'candidate-1',
      organizationId: 'org-1',
      status: 'INTERVIEWING',
      interviewPlan: {
        version: 1,
        source: 'JOB_TEMPLATE',
        generatedAt: '2026-03-10T08:20:00.843Z',
        status: 'COMPLETED',
        currentStageId: 'final-interview',
        stages: [
          {
            id: 'recruiter-screen',
            sequence: 1,
            name: 'Recruiter Screen',
            category: 'SCREENING',
            status: 'COMPLETED',
            outcome: 'PASS',
            advanceRule: 'PASS_REQUIRED',
          },
          {
            id: 'sme-interview',
            sequence: 2,
            name: 'SME Interview',
            category: 'TECHNICAL',
            status: 'COMPLETED',
            outcome: 'PASS',
            advanceRule: 'PASS_REQUIRED',
          },
          {
            id: 'final-interview',
            sequence: 3,
            name: 'Final Interview',
            category: 'FINAL',
            status: 'COMPLETED',
            outcome: 'PENDING',
            advanceRule: 'PASS_REQUIRED',
          },
        ],
      },
      statusHistory: [],
    });

    const req = buildReq('OFFER');
    const res = createResponse();
    const next = jest.fn();

    await ApplicationController.updateApplicationStatus(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: 'Record a Pass outcome for this stage before creating the next stage.',
      code: 'INTERVIEW_STAGE_OUTCOME_REQUIRED',
      details: expect.objectContaining({
        blockingStageId: 'final-interview',
        blockingStageName: 'Final Interview',
        blockingStageOutcome: 'PENDING',
        blockingStageStatus: 'COMPLETED',
      }),
    }));
    expect(mockJobApplicationStore.update).not.toHaveBeenCalled();
  });
});
