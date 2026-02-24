import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIInterviewer } from '../aiInterviewer';
import { callOllama, parseJSONResponse } from '../llmClient.js';

vi.mock('../llmClient.js', () => ({
  callOllama: vi.fn(),
  parseJSONResponse: vi.fn(),
}));

describe('AIInterviewer config propagation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('injects selected job details into interview prompts', async () => {
    const interviewer = new AIInterviewer({
      jobRole: 'software-engineer',
      company: 'Acme Labs',
      experienceLevel: 'mid',
      industry: 'technology',
      totalQuestions: 12,
    });

    callOllama.mockResolvedValueOnce('Welcome prompt');
    await interviewer.startInterview();

    const startMessages = callOllama.mock.calls[0][0];
    expect(startMessages[0].content).toContain('software-engineer');
    expect(startMessages[0].content).toContain('Acme Labs');

    callOllama.mockResolvedValueOnce('{"message":"Question 1","type":"technical","insights":["x"]}');
    parseJSONResponse.mockReturnValueOnce({
      message: 'Question 1',
      type: 'technical',
      insights: ['x'],
    });
    await interviewer.processIntroduction('My intro');

    const introMessages = callOllama.mock.calls[1][0];
    expect(introMessages[0].content).toContain('software-engineer');
    expect(introMessages[0].content).toContain('Acme Labs');

    callOllama.mockResolvedValueOnce('{"score":7,"action":"next_question","message":"Next question"}');
    parseJSONResponse.mockReturnValueOnce({
      score: 7,
      action: 'next_question',
      message: 'Next question',
    });
    await interviewer.processAnswer('Sample answer');

    const answerMessages = callOllama.mock.calls[2][0];
    expect(answerMessages[0].content).toContain("You're interviewing for software-engineer");
    expect(answerMessages[0].content).toContain('Question 1/12');
  });
});

