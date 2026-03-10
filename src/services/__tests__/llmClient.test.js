import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('llmClient', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('times out stalled Ollama chat requests', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, init = {}) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener?.('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        reject(abortError);
      });
    })));

    const clientPromise = import('../llmClient.js').then(({ callOllama }) => (
      callOllama([{ role: 'user', content: 'Hello' }], { timeoutMs: 25 })
    ));

    await expect(clientPromise).rejects.toThrow(/timed out/i);
  }, 1000);
});
