import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apiClient.js', () => ({
  apiClient: {
    interviews: {
      markQuestionAsked: vi.fn(),
      getById: vi.fn(),
    },
  },
}));

vi.mock('../../config/firebase.js', () => ({
  realtimeDb: null,
}));

import { apiClient } from '../apiClient.js';
import InterviewBackendSync from '../interviewBackendSync.js';

describe('InterviewBackendSync question tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts pending question sync requests on destroy without logging an error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.interviews.markQuestionAsked.mockImplementation(
      (_interviewId, _questionId, options = {}) => new Promise((resolve, reject) => {
        options.signal?.addEventListener('abort', () => {
          const error = new DOMException('The user aborted a request.', 'AbortError');
          reject(error);
        });
        setTimeout(resolve, 1000);
      }),
    );

    const sync = new InterviewBackendSync('interview-123');
    const pendingRequest = sync.markQuestionAsked('question-1');
    sync.destroy();

    await expect(pendingRequest).resolves.toBe(false);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('still logs real question sync failures', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiClient.interviews.markQuestionAsked.mockRejectedValue(new Error('server unavailable'));

    const sync = new InterviewBackendSync('interview-123');

    await expect(sync.markQuestionAsked('question-1')).resolves.toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to mark question as asked:',
      expect.any(Error),
    );
  });
});
