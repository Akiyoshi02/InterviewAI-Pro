import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockInterviewStore = {
  listCompletedForReviewReminders: jest.fn(),
  getById: jest.fn(),
  update: jest.fn(),
};
const mockUserStore = { getSummary: jest.fn() };
const mockJobStore = { getById: jest.fn() };
const mockOrganizationStore = { getById: jest.fn() };
const mockNotificationStore = { create: jest.fn() };

jest.unstable_mockModule('../firebaseData.service.js', () => ({
  interviewStore: mockInterviewStore,
  userStore: mockUserStore,
  jobStore: mockJobStore,
  organizationStore: mockOrganizationStore,
  notificationStore: mockNotificationStore,
}));

const mockSendReviewRequestReminder = jest.fn();
jest.unstable_mockModule('../email.service.js', () => ({
  emailNotifications: {
    sendReviewRequestReminder: mockSendReviewRequestReminder,
  },
}));

const mockQueueEmailJob = jest.fn();
jest.unstable_mockModule('../backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

const {
  startReviewReminderScheduler,
  stopReviewReminderScheduler,
} = await import('../reviewReminderScheduler.service.js');

const waitForTick = () => new Promise((resolve) => setTimeout(resolve, 100));

const buildCompletedInterview = (overrides = {}) => ({
  id: 'interview-1',
  status: 'COMPLETED',
  candidateId: 'candidate-1',
  jobId: 'job-1',
  organizationId: 'org-1',
  jobRole: 'DevOps Engineer',
  timezone: 'UTC',
  completedAt: '2026-03-06T08:00:00.000Z',
  reviewRequests: [
    {
      reviewerId: 'reviewer-1',
      assignedAt: '2026-03-06T08:00:00.000Z',
      dueAt: '2099-03-07T08:00:00.000Z',
      dueSource: 'AUTO',
      lastReminderAt: null,
      completedAt: null,
      completedReviewId: null,
    },
  ],
  ...overrides,
});

describe('reviewReminderScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.getById.mockImplementation(async () => buildCompletedInterview());
    mockInterviewStore.update.mockResolvedValue(undefined);
    mockNotificationStore.create.mockResolvedValue(undefined);
    mockQueueEmailJob.mockImplementation(({ handler, onSuccess }) => {
      if (typeof handler === 'function') {
        void handler();
      }
      if (typeof onSuccess === 'function') {
        void onSuccess();
      }
      return 'job-1';
    });
    mockUserStore.getSummary.mockImplementation(async (id) => {
      if (id === 'reviewer-1') {
        return { id, email: 'reviewer@example.com', fullName: 'Reviewer One' };
      }
      if (id === 'candidate-1') {
        return { id, email: 'candidate@example.com', fullName: 'Candidate One' };
      }
      return null;
    });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'DevOps Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Cynectex' });
  });

  afterEach(() => {
    stopReviewReminderScheduler();
  });

  it('queues a due-soon reminder and stamps lastReminderAt after success', async () => {
    const dueSoonInterview = buildCompletedInterview({
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-06T08:00:00.000Z',
          dueAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          dueSource: 'AUTO',
          lastReminderAt: null,
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });
    mockInterviewStore.listCompletedForReviewReminders.mockResolvedValue([dueSoonInterview]);
    mockInterviewStore.getById.mockResolvedValue(dueSoonInterview);

    startReviewReminderScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    expect(mockSendReviewRequestReminder).toHaveBeenCalledWith(expect.objectContaining({
      workflowState: 'DUE_SOON',
      reviewUrl: expect.stringContaining('/company-reviews?interviewId=interview-1'),
    }));
    expect(mockInterviewStore.update).toHaveBeenCalledWith('interview-1', expect.objectContaining({
      reviewRequests: expect.arrayContaining([
        expect.objectContaining({
          reviewerId: 'reviewer-1',
          lastReminderAt: expect.any(String),
          reminderHistory: expect.arrayContaining([
            expect.objectContaining({
              workflowState: 'DUE_SOON',
              channel: 'EMAIL',
              sentAt: expect.any(String),
            }),
          ]),
        }),
      ]),
    }));
    expect(mockNotificationStore.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'reviewer-1',
      type: 'review_reminder',
      title: 'Review due soon',
      link: '/company-reviews?interviewId=interview-1',
    }));
  });

  it('skips due-soon reminders once a reminder was already sent', async () => {
    const dueSoonInterview = buildCompletedInterview({
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-06T08:00:00.000Z',
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          dueSource: 'AUTO',
          lastReminderAt: new Date().toISOString(),
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });
    mockInterviewStore.listCompletedForReviewReminders.mockResolvedValue([dueSoonInterview]);

    startReviewReminderScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
    expect(mockNotificationStore.create).not.toHaveBeenCalled();
  });

  it('queues an overdue reminder again after the cooldown window elapses', async () => {
    const overdueInterview = buildCompletedInterview({
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-04T08:00:00.000Z',
          dueAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          dueSource: 'AUTO',
          lastReminderAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
          completedAt: null,
          completedReviewId: null,
        },
      ],
    });
    mockInterviewStore.listCompletedForReviewReminders.mockResolvedValue([overdueInterview]);
    mockInterviewStore.getById.mockResolvedValue(overdueInterview);

    startReviewReminderScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    expect(mockSendReviewRequestReminder).toHaveBeenCalledWith(expect.objectContaining({
      workflowState: 'OVERDUE',
    }));
    expect(mockNotificationStore.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Review overdue',
    }));
    expect(mockInterviewStore.update).toHaveBeenCalledWith('interview-1', expect.objectContaining({
      reviewRequests: expect.arrayContaining([
        expect.objectContaining({
          reviewerId: 'reviewer-1',
          reminderHistory: expect.arrayContaining([
            expect.objectContaining({
              workflowState: 'OVERDUE',
              channel: 'EMAIL',
            }),
          ]),
        }),
      ]),
    }));
  });

  it('does not queue reminders for completed review requests', async () => {
    const completedInterview = buildCompletedInterview({
      reviewRequests: [
        {
          reviewerId: 'reviewer-1',
          assignedAt: '2026-03-06T08:00:00.000Z',
          dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          dueSource: 'AUTO',
          lastReminderAt: null,
          completedAt: '2026-03-06T10:00:00.000Z',
          completedReviewId: 'review-1',
        },
      ],
    });
    mockInterviewStore.listCompletedForReviewReminders.mockResolvedValue([completedInterview]);

    startReviewReminderScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
    expect(mockInterviewStore.update).not.toHaveBeenCalled();
  });
});
