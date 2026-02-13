import { randomUUID } from 'crypto';
import logger from '../utils/logger.js';

const QUEUE_MODES = new Set(['ASYNC', 'INLINE']);

const normalizeQueueMode = (value) => {
  const normalized = String(value || 'ASYNC').trim().toUpperCase();
  return QUEUE_MODES.has(normalized) ? normalized : 'ASYNC';
};

const calculateRetryDelayMs = (attempt) => {
  const baseDelay = 250;
  const cappedAttempt = Math.min(Math.max(attempt, 1), 6);
  return baseDelay * (2 ** (cappedAttempt - 1));
};

class InMemoryBackgroundQueue {
  constructor(name, { concurrency = 1 } = {}) {
    this.name = name;
    this.concurrency = Math.max(1, Number.parseInt(concurrency, 10) || 1);
    this.mode = normalizeQueueMode(process.env.JOB_QUEUE_MODE);
    this.pending = [];
    this.runningCount = 0;
    this.totalProcessed = 0;
    this.totalFailed = 0;
  }

  enqueue({
    type,
    handler,
    payload = {},
    maxAttempts = 3,
  }) {
    if (typeof handler !== 'function') {
      throw new Error(`[${this.name}] Queue handler must be a function.`);
    }

    const job = {
      id: randomUUID(),
      queue: this.name,
      type: type || 'UNKNOWN',
      payload,
      handler,
      attempts: 0,
      maxAttempts: Math.max(1, Number.parseInt(maxAttempts, 10) || 3),
      enqueuedAt: new Date().toISOString(),
    };

    if (this.mode === 'INLINE') {
      // Inline mode is used by tests for deterministic execution.
      void this.#runJob(job);
      return job.id;
    }

    this.pending.push(job);
    this.#drain();
    return job.id;
  }

  getStats() {
    return {
      name: this.name,
      mode: this.mode,
      concurrency: this.concurrency,
      pending: this.pending.length,
      running: this.runningCount,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
    };
  }

  async waitForIdle(timeoutMs = 5000) {
    const start = Date.now();
    while (this.pending.length > 0 || this.runningCount > 0) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`[${this.name}] Timed out waiting for queue to become idle.`);
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }

  #drain() {
    while (this.runningCount < this.concurrency && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) break;
      void this.#runJob(job);
    }
  }

  async #runJob(job) {
    this.runningCount += 1;
    job.attempts += 1;

    try {
      await job.handler(job.payload);
      this.totalProcessed += 1;
    } catch (error) {
      const shouldRetry = job.attempts < job.maxAttempts;
      if (shouldRetry) {
        const retryDelayMs = calculateRetryDelayMs(job.attempts);
        logger.warn(
          `[${this.name}] Job ${job.type} (${job.id}) failed attempt ${job.attempts}/${job.maxAttempts}; retrying in ${retryDelayMs}ms.`,
          error,
        );
        setTimeout(() => {
          this.pending.push(job);
          this.#drain();
        }, retryDelayMs);
      } else {
        this.totalFailed += 1;
        logger.error(
          `[${this.name}] Job ${job.type} (${job.id}) failed permanently after ${job.attempts} attempts.`,
          error,
        );
      }
    } finally {
      this.runningCount -= 1;
      this.#drain();
    }
  }
}

const emailQueue = new InMemoryBackgroundQueue('email', { concurrency: 2 });
const analyticsQueue = new InMemoryBackgroundQueue('analytics', { concurrency: 1 });

export const queueEmailJob = ({ type, handler, payload, maxAttempts = 3 }) => {
  try {
    return emailQueue.enqueue({ type, handler, payload, maxAttempts });
  } catch (error) {
    logger.error(`[email] Failed to enqueue ${type || 'UNKNOWN'} job.`, error);
    return null;
  }
};

export const queueAnalyticsJob = ({ type, handler, payload, maxAttempts = 2 }) => {
  try {
    return analyticsQueue.enqueue({ type, handler, payload, maxAttempts });
  } catch (error) {
    logger.error(`[analytics] Failed to enqueue ${type || 'UNKNOWN'} job.`, error);
    return null;
  }
};

export const backgroundJobQueueStats = () => ({
  email: emailQueue.getStats(),
  analytics: analyticsQueue.getStats(),
});

export const waitForBackgroundJobs = async (timeoutMs = 5000) => {
  await Promise.all([
    emailQueue.waitForIdle(timeoutMs),
    analyticsQueue.waitForIdle(timeoutMs),
  ]);
};
