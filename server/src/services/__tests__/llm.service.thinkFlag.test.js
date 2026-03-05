import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

const originalFetch = global.fetch;

const createJsonResponse = (payload) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  async json() {
    return payload;
  },
});

const createErrorResponse = (status, statusText, bodyText) => ({
  ok: false,
  status,
  statusText,
  async text() {
    return bodyText;
  },
});

describe('LLMService thinking flag handling', () => {
  beforeEach(() => {
    jest.resetModules();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
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
});
