import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: mockLogger,
}));

describe('backgroundJobQueue.service', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.JOB_QUEUE_MODE = 'INLINE';
  });

  afterEach(() => {
    delete process.env.JOB_QUEUE_MODE;
  });

  it('does not rerun the handler when the success callback fails', async () => {
    const {
      queueEmailJob,
      waitForBackgroundJobs,
      backgroundJobQueueStats,
    } = await import('../backgroundJobQueue.service.js');

    const handler = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn().mockRejectedValue(new Error('write failed'));
    const onPermanentFailure = jest.fn().mockResolvedValue(undefined);

    queueEmailJob({
      type: 'MEETING_LINK_REMINDER',
      handler,
      payload: { interviewId: 'int-1' },
      maxAttempts: 3,
      onSuccess,
      onPermanentFailure,
    });

    await waitForBackgroundJobs();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onPermanentFailure).toHaveBeenCalledTimes(1);
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('success callback failed'),
      expect.any(Error),
    );
    expect(backgroundJobQueueStats().email.totalProcessed).toBe(1);
  });
});
