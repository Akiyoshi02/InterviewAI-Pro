import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalNavigatorWebdriver = Object.getOwnPropertyDescriptor(window.navigator, 'webdriver');

const setNavigatorWebdriver = (value) => {
  Object.defineProperty(window.navigator, 'webdriver', {
    configurable: true,
    value,
  });
};

describe('localWhisperService health checks', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
    setNavigatorWebdriver(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    global.fetch = originalFetch;
    if (originalNavigatorWebdriver) {
      Object.defineProperty(window.navigator, 'webdriver', originalNavigatorWebdriver);
    } else {
      delete window.navigator.webdriver;
    }
  });

  it('returns false in automation environments without probing the backend', async () => {
    setNavigatorWebdriver(true);
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy;

    const module = await import('../localWhisperService.js');
    const result = await module.checkLocalWhisperHealth();

    expect(result).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses backend AI health to resolve local whisper availability', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        whisperConfigured: true,
        whisperReachable: true,
      }),
    });
    global.fetch = fetchSpy;

    const module = await import('../localWhisperService.js');
    const result = await module.checkLocalWhisperHealth({ force: true });

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/ai/health',
      expect.objectContaining({ headers: {}, method: 'GET' }),
    );
  });

  it('posts audio to the backend whisper proxy instead of the local whisper process', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        text: 'hello world',
        language: 'en',
        segments: [],
      }),
    });
    global.fetch = fetchSpy;

    const module = await import('../localWhisperService.js');
    const result = await module.transcribeWithLocalWhisper(
      new Blob(['audio-bytes'], { type: 'audio/webm' }),
      { language: 'en' },
    );

    expect(result).toEqual(expect.objectContaining({
      language: 'en',
      source: 'local-whisper',
      text: 'hello world',
    }));

    const [url, request] = fetchSpy.mock.calls[0];
    expect(url).toBe('http://localhost:3000/api/ai/whisper/transcribe');
    expect(request).toEqual(expect.objectContaining({
      headers: {},
      method: 'POST',
    }));
    expect(request.body).toBeInstanceOf(FormData);
  });

  it('loads whisper models through the backend proxy', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current_model: 'large-v3',
      }),
    });
    global.fetch = fetchSpy;

    const module = await import('../localWhisperService.js');
    const result = await module.getLocalWhisperModels();

    expect(result.current_model).toBe('large-v3');
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3000/api/ai/whisper/models',
      expect.objectContaining({ headers: {}, method: 'GET' }),
    );
  });
});
