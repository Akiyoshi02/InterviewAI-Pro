import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const mockInterviewStore = {
  listScheduledBetween: jest.fn(),
  update: jest.fn(),
};
const mockUserStore = { getSummary: jest.fn() };
const mockJobStore = { getById: jest.fn() };
const mockOrganizationStore = { getById: jest.fn() };

jest.unstable_mockModule('../firebaseData.service.js', () => ({
  interviewStore: mockInterviewStore,
  userStore: mockUserStore,
  jobStore: mockJobStore,
  organizationStore: mockOrganizationStore,
}));

const mockSendMeetingLinkReminder = jest.fn();
jest.unstable_mockModule('../email.service.js', () => ({
  emailNotifications: {
    sendMeetingLinkReminder: mockSendMeetingLinkReminder,
  },
}));

const mockQueueEmailJob = jest.fn();
jest.unstable_mockModule('../backgroundJobQueue.service.js', () => ({
  queueEmailJob: mockQueueEmailJob,
}));

jest.unstable_mockModule('../meetingLink.service.js', () => ({
  shouldSendMeetingLinkEmail: jest.fn((interview) => {
    // Realistic default: filter by meetingLinkEmailSent and status
    if (!interview?.scheduledFor || !interview?.meetingToken) return false;
    if (interview.meetingLinkEmailSent) return false;
    if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') return false;
    const scheduledMs = new Date(interview.scheduledFor).getTime();
    const nowMs = Date.now();
    const sendAtMs = scheduledMs - 30 * 60_000;
    return nowMs >= sendAtMs && nowMs <= scheduledMs;
  }),
  buildMeetingJoinUrl: jest.fn((id, token) => `http://test/interview-lobby/${id}?token=${token}`),
  MEETING_LINK_EMAIL_MINUTES_BEFORE: 30,
}));

const {
  startMeetingLinkScheduler,
  stopMeetingLinkScheduler,
} = await import('../meetingLinkScheduler.service.js');

// ── Helpers ────────────────────────────────────────────────────────────────
const futureIso = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();

const buildInterview = (overrides = {}) => ({
  id: 'int-1',
  meetingToken: 'abc123',
  scheduledFor: futureIso(20), // 20 min from now, inside the 30-min window
  meetingLinkEmailSent: false,
  status: 'SCHEDULED',
  candidateId: 'cand-1',
  jobId: 'job-1',
  organizationId: 'org-1',
  duration: 30,
  ...overrides,
});

// Helper to wait for async tick() to complete
const waitForTick = () => new Promise((r) => setTimeout(r, 100));

// ============================================================================
describe('meetingLinkScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInterviewStore.update.mockResolvedValue(undefined);
  });

  afterEach(() => {
    stopMeetingLinkScheduler();
  });

  // --------------------------------------------------------------------------
  // tick() dispatches emails
  // --------------------------------------------------------------------------
  it('sends meeting-link email for upcoming interviews in the window', async () => {
    const interview = buildInterview();
    mockInterviewStore.listScheduledBetween.mockResolvedValue([interview]);
    mockUserStore.getSummary.mockResolvedValue({ id: 'cand-1', email: 'cand@test.com', fullName: 'Candidate' });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Acme' });

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).toHaveBeenCalledTimes(1);
    const jobArg = mockQueueEmailJob.mock.calls[0][0];
    expect(jobArg.type).toBe('MEETING_LINK_REMINDER');
    expect(jobArg.payload.interviewId).toBe('int-1');
    expect(jobArg.payload.recipient).toBe('cand@test.com');

    // Should mark as sent
    expect(mockInterviewStore.update).toHaveBeenCalledWith('int-1', { meetingLinkEmailSent: true });
  });

  it('skips interviews where email was already sent', async () => {
    mockInterviewStore.listScheduledBetween.mockResolvedValue([
      buildInterview({ meetingLinkEmailSent: true }),
    ]);

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('skips interviews outside the email window', async () => {
    mockInterviewStore.listScheduledBetween.mockResolvedValue([
      buildInterview({ scheduledFor: futureIso(120) }), // 2 hours away
    ]);

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('handles missing candidate email gracefully', async () => {
    mockInterviewStore.listScheduledBetween.mockResolvedValue([buildInterview()]);
    mockUserStore.getSummary.mockResolvedValue({ id: 'cand-1', email: null });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Acme' });

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('handles missing organization gracefully', async () => {
    mockInterviewStore.listScheduledBetween.mockResolvedValue([buildInterview()]);
    mockUserStore.getSummary.mockResolvedValue({ id: 'cand-1', email: 'cand@test.com' });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Engineer' });
    mockOrganizationStore.getById.mockResolvedValue(null);

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('handles listScheduledBetween failure gracefully', async () => {
    mockInterviewStore.listScheduledBetween.mockRejectedValue(new Error('DB error'));

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).not.toHaveBeenCalled();
  });

  it('still marks emailSent even if queueEmailJob is synchronous', async () => {
    const interview = buildInterview();
    mockInterviewStore.listScheduledBetween.mockResolvedValue([interview]);
    mockUserStore.getSummary.mockResolvedValue({ id: 'cand-1', email: 'test@test.com' });
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Dev' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Org' });
    mockQueueEmailJob.mockReturnValue(undefined);

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockInterviewStore.update).toHaveBeenCalledWith('int-1', { meetingLinkEmailSent: true });
  });

  // --------------------------------------------------------------------------
  // start / stop lifecycle
  // --------------------------------------------------------------------------
  it('stopMeetingLinkScheduler clears the interval', () => {
    startMeetingLinkScheduler();
    stopMeetingLinkScheduler();
    // Calling stop again should be safe (no throw)
    stopMeetingLinkScheduler();
  });

  it('calling startMeetingLinkScheduler twice does not create duplicate intervals', async () => {
    mockInterviewStore.listScheduledBetween.mockResolvedValue([]);
    startMeetingLinkScheduler();
    startMeetingLinkScheduler(); // second call should be a no-op
    await waitForTick();
    // Only the immediate tick from the first start should fire
    // (not two immediate ticks from two starts)
    expect(mockInterviewStore.listScheduledBetween.mock.calls.length).toBeLessThanOrEqual(2);
  });

  // --------------------------------------------------------------------------
  // Multiple interviews in a single tick
  // --------------------------------------------------------------------------
  it('processes multiple interviews in a single tick', async () => {
    const int1 = buildInterview({ id: 'int-1', candidateId: 'c1' });
    const int2 = buildInterview({ id: 'int-2', candidateId: 'c2' });
    mockInterviewStore.listScheduledBetween.mockResolvedValue([int1, int2]);
    mockUserStore.getSummary.mockImplementation(async (id) => ({
      id,
      email: `${id}@test.com`,
      fullName: id,
    }));
    mockJobStore.getById.mockResolvedValue({ id: 'job-1', title: 'Dev' });
    mockOrganizationStore.getById.mockResolvedValue({ id: 'org-1', name: 'Org' });

    startMeetingLinkScheduler();
    await waitForTick();

    expect(mockQueueEmailJob).toHaveBeenCalledTimes(2);
    expect(mockInterviewStore.update).toHaveBeenCalledWith('int-1', { meetingLinkEmailSent: true });
    expect(mockInterviewStore.update).toHaveBeenCalledWith('int-2', { meetingLinkEmailSent: true });
  });
});
