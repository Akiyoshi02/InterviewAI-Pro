import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalFetch = global.fetch;
const originalWhisperUrl = process.env.LOCAL_WHISPER_URL;
const originalWhisperServerUrl = process.env.WHISPER_SERVER_URL;

const createJsonResponse = (payload) => ({
  ok: true,
  status: 200,
  async json() {
    return payload;
  },
});

describe('LLMService whisper proxy helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    delete process.env.LOCAL_WHISPER_URL;
    process.env.WHISPER_SERVER_URL = 'http://localhost:5000';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    if (originalWhisperUrl === undefined) {
      delete process.env.LOCAL_WHISPER_URL;
    } else {
      process.env.LOCAL_WHISPER_URL = originalWhisperUrl;
    }
    if (originalWhisperServerUrl === undefined) {
      delete process.env.WHISPER_SERVER_URL;
    } else {
      process.env.WHISPER_SERVER_URL = originalWhisperServerUrl;
    }
  });

  it('fetches whisper models from the configured service', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        current_model: 'large-v3',
        available_models: { 'large-v3': { quality: 'Best' } },
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const result = await LLMService.getWhisperModels();

    expect(result.current_model).toBe('large-v3');
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/models',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('accepts WHISPER_SERVER_URL as the configured whisper base URL alias', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        status: 'healthy',
        model: 'large-v3',
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const result = await LLMService.getWhisperHealth();

    expect(result).toEqual(expect.objectContaining({
      configured: true,
      reachable: true,
      model: 'large-v3',
    }));
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:5000/health',
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    );
  });

  it('forwards audio transcription through the configured whisper service', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        success: true,
        text: 'hello world',
        language: 'en',
        segments: [],
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const payload = await LLMService.proxyWhisperTranscription({
      audioBuffer: Buffer.from('audio-bytes'),
      fileName: 'sample.webm',
      mimeType: 'audio/webm',
      language: 'en',
      task: 'transcribe',
    });

    expect(payload.text).toBe('hello world');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, request] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:5000/transcribe');
    expect(request.method).toBe('POST');
    expect(request.body).toBeInstanceOf(FormData);
  });
});
