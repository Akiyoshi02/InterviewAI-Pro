import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

const createHeaders = (values = {}) => ({
  get(name) {
    const match = Object.entries(values).find(([key]) => key.toLowerCase() === String(name).toLowerCase());
    return match ? match[1] : null;
  },
});

const createJsonResponse = (payload, headers = {}) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  headers: createHeaders(headers),
  async json() {
    return payload;
  },
});

const createErrorResponse = (status, statusText, bodyText) => ({
  ok: false,
  status,
  statusText,
  headers: createHeaders(),
  async text() {
    return bodyText;
  },
});

describe('LLMService thinking flag handling', () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
    jest.restoreAllMocks();
  });

  it('sends think:false by default so qwen-style models return answer content', async () => {
    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        message: {
          role: 'assistant',
          content: 'Acknowledged.',
        },
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateWithFallback({
      systemPrompt: 'System prompt',
      userMessage: 'Reply briefly.',
      llmOptions: {
        model: 'unit-test-primary-model',
      },
    });

    expect(output).toBe('Acknowledged.');
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [, request] = global.fetch.mock.calls[0];
    const parsedBody = JSON.parse(request.body);
    expect(parsedBody.model).toBe('unit-test-primary-model');
    expect(parsedBody).toHaveProperty('think', false);
  });

  it('retries without think parameter when model rejects thinking toggle', async () => {
    global.fetch
      .mockResolvedValueOnce(
        createErrorResponse(
          400,
          'Bad Request',
          JSON.stringify({ error: 'model does not support thinking' }),
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          message: {
            role: 'assistant',
            content: 'Fallback success',
          },
        }),
      );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateWithFallback({
      systemPrompt: 'System prompt',
      userMessage: 'Reply briefly.',
      llmOptions: {
        model: 'unit-test-no-think-model',
      },
    });

    expect(output).toBe('Fallback success');
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstBody).toHaveProperty('think', false);
    expect(secondBody).not.toHaveProperty('think');
  });

  it('recovers from thinking-only empty content by retrying same model with think:false', async () => {
    global.fetch
      .mockResolvedValueOnce(
        createJsonResponse({
          model: 'unit-test-thinking-model',
          done_reason: 'length',
          message: {
            role: 'assistant',
            content: '',
            thinking: 'internal reasoning without final answer',
          },
        }),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              overallScore: 78,
              readinessLevel: 'Intermediate',
              strengths: ['Clear communication'],
              weaknesses: ['Needs deeper examples'],
              technicalSkills: { score: 74, feedback: 'Solid baseline technical coverage.' },
              communicationSkills: { score: 82, feedback: 'Good structure and clarity.' },
              recommendations: ['Use more measurable outcomes in examples.'],
              detailedFeedback: 'Overall performance is promising with room for deeper detail.',
            }),
          },
        }),
      );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateInterviewSummary({
      interview: {
        jobRole: 'Software Engineer',
        experienceLevel: 'MID',
        industry: 'Technology',
      },
      questions: [],
      llmOptions: {
        model: 'unit-test-thinking-model',
      },
    });

    expect(output).toEqual(expect.objectContaining({ overallScore: expect.any(Number) }));
    expect(global.fetch).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstBody).toHaveProperty('think', true);
    expect(secondBody).toHaveProperty('think', false);
  });

  it('routes interview summary generation to Groq when interview provider is configured', async () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.INTERVIEW_GROQ_MODEL = 'openai/gpt-oss-20b';

    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify({
                overallScore: 84,
                readinessLevel: 'Advanced',
                strengths: ['Strong structure'],
                weaknesses: ['Could add more metrics'],
                technicalSkills: { score: 86, feedback: 'Strong technical depth.' },
                communicationSkills: { score: 82, feedback: 'Clear and concise.' },
                recommendations: ['Add one more quantified result.'],
                detailedFeedback: 'Good performance overall.',
              }),
            },
          },
        ],
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateInterviewSummary({
      interview: {
        jobRole: 'Software Engineer',
        experienceLevel: 'MID',
        industry: 'Technology',
      },
      questions: [],
    });

    expect(output).toEqual(expect.objectContaining({ overallScore: 84 }));
    expect(output._meta).toEqual(expect.objectContaining({
      provider: 'groq',
      model: 'openai/gpt-oss-20b',
      usedFallback: false,
      fallbackAttempted: false,
      attemptedModels: ['openai/gpt-oss-20b'],
    }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');

    const request = global.fetch.mock.calls[0][1];
    const parsedBody = JSON.parse(request.body);
    expect(request.headers.Authorization).toBe('Bearer gsk-test');
    expect(parsedBody.model).toBe('openai/gpt-oss-20b');
    expect(parsedBody.response_format).toEqual(
      expect.objectContaining({
        type: 'json_schema',
      }),
    );
  });

  it('falls back to the local primary Ollama model when Groq interview limits are exceeded', async () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.INTERVIEW_GROQ_MODEL = 'openai/gpt-oss-120b';
    process.env.INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA = 'true';
    process.env.OLLAMA_MODEL = 'unit-test-local-primary';
    process.env.OLLAMA_FALLBACK_MODEL = 'unit-test-local-secondary';

    global.fetch
      .mockResolvedValueOnce(
        createErrorResponse(
          429,
          'Too Many Requests',
          JSON.stringify({ error: { message: 'Rate limit exceeded: TPD limit reached for today' } }),
        ),
      )
      .mockResolvedValueOnce(
        createErrorResponse(
          404,
          'Not Found',
          JSON.stringify({ error: 'model not found' }),
        ),
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          message: {
            role: 'assistant',
            content: JSON.stringify({
              overallScore: 79,
              readinessLevel: 'Intermediate',
              strengths: ['Good structure'],
              weaknesses: ['Needs stronger metrics'],
              technicalSkills: { score: 80, feedback: 'Solid technical foundation.' },
              communicationSkills: { score: 78, feedback: 'Clear communication overall.' },
              recommendations: ['Quantify one outcome more clearly.'],
              detailedFeedback: 'Recovered through the local fallback path.',
            }),
          },
        }),
      );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateInterviewSummary({
      interview: {
        jobRole: 'Software Engineer',
        experienceLevel: 'MID',
        industry: 'Technology',
      },
      questions: [],
    });

    expect(output).toEqual(expect.objectContaining({ overallScore: 79 }));
    expect(output._meta).toEqual(expect.objectContaining({
      provider: 'groq->ollama',
      model: 'unit-test-local-primary',
      usedFallback: true,
      fallbackAttempted: true,
      attemptedModels: [
        'openai/gpt-oss-120b',
        'unit-test-local-primary',
        'unit-test-local-secondary',
      ],
    }));
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(global.fetch.mock.calls[1][0]).toBe('http://localhost:11434/api/show');
    expect(global.fetch.mock.calls[2][0]).toBe('http://localhost:11434/api/chat');

    const ollamaRequest = JSON.parse(global.fetch.mock.calls[2][1].body);
    expect(ollamaRequest.model).toBe('unit-test-local-primary');

    const runtime = LLMService.getRuntimeModelStatus();
    expect(runtime.lastRequestedProvider).toBe('groq->ollama');
    expect(runtime.lastRequestedModel).toBe('openai/gpt-oss-120b');
    expect(runtime.lastSuccessfulModel).toBe('unit-test-local-primary');
    expect(runtime.lastUsedFallback).toBe(true);
    expect(runtime.lastAttemptedModels).toEqual([
      'openai/gpt-oss-120b',
      'unit-test-local-primary',
      'unit-test-local-secondary',
    ]);
  });

  it('does not hide non-limit Groq errors behind the local fallback path', async () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.INTERVIEW_GROQ_MODEL = 'openai/gpt-oss-120b';
    process.env.INTERVIEW_GROQ_LIMIT_FALLBACK_TO_OLLAMA = 'true';

    global.fetch.mockResolvedValueOnce(
      createErrorResponse(
        401,
        'Unauthorized',
        JSON.stringify({ error: { message: 'Invalid API key provided' } }),
      ),
    );

    const { LLMService } = await import('../llm.service.js');

    await expect(
      LLMService.generateInterviewSummary({
        interview: {
          jobRole: 'Software Engineer',
          experienceLevel: 'MID',
          industry: 'Technology',
        },
        questions: [],
      }),
    ).rejects.toThrow(/401 Unauthorized/);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('reports Groq rate-limit header snapshots through interview provider health', async () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.INTERVIEW_GROQ_MODEL = 'openai/gpt-oss-120b';

    global.fetch.mockResolvedValueOnce(
      createJsonResponse(
        {
          data: [
            { id: 'openai/gpt-oss-120b' },
            { id: 'openai/gpt-oss-20b' },
          ],
        },
        {
          'x-ratelimit-limit-requests': '1000',
          'x-ratelimit-remaining-requests': '742',
          'x-ratelimit-reset-requests': '14h12m',
          'x-ratelimit-limit-tokens': '8000',
          'x-ratelimit-remaining-tokens': '6123',
          'x-ratelimit-reset-tokens': '9.2s',
        },
      ),
    );

    const { LLMService } = await import('../llm.service.js');
    const health = await LLMService.getInterviewProviderHealth();

    expect(health.provider).toBe('groq');
    expect(health.modelReady).toBe(true);
    expect(health.rateLimits).toEqual(
      expect.objectContaining({
        requestsLimit: 1000,
        requestsRemaining: 742,
        requestsReset: '14h12m',
        tokensLimit: 8000,
        tokensRemaining: 6123,
        tokensReset: '9.2s',
      }),
    );

    const runtime = LLMService.getRuntimeModelStatus();
    expect(runtime.groqRateLimits).toEqual(
      expect.objectContaining({
        requestsRemaining: 742,
        tokensRemaining: 6123,
      }),
    );
  });

  it('keeps non-interview generateWithFallback calls on Ollama even when Groq is enabled for interviews', async () => {
    process.env.INTERVIEW_LLM_PROVIDER = 'groq';
    process.env.GROQ_API_KEY = 'gsk-test';
    process.env.INTERVIEW_GROQ_MODEL = 'openai/gpt-oss-20b';

    global.fetch.mockResolvedValueOnce(
      createJsonResponse({
        message: {
          role: 'assistant',
          content: 'Local Ollama response',
        },
      }),
    );

    const { LLMService } = await import('../llm.service.js');
    const output = await LLMService.generateWithFallback({
      systemPrompt: 'System prompt',
      userMessage: 'Reply briefly.',
      llmOptions: {
        model: 'unit-test-primary-model',
      },
    });

    expect(output).toBe('Local Ollama response');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][0]).toBe('http://localhost:11434/api/chat');

    const parsedBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(parsedBody.model).toBe('unit-test-primary-model');
    expect(parsedBody).toHaveProperty('think', false);
  });
});
