import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AIInterviewer } from '../aiInterviewer';
import { callOllama, parseJSONResponse } from '../llmClient.js';

vi.mock('../llmClient.js', () => ({
  callOllama: vi.fn(),
  parseJSONResponse: vi.fn(),
}));

describe('AIInterviewer structured question flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses questionBank questions for deterministic progression', async () => {
    const interviewer = new AIInterviewer({
      totalQuestions: 2,
      questionBank: [
        { id: 'q1', question: 'Tell me about a challenging bug you fixed.', type: 'behavioral' },
        { id: 'q2', question: 'How would you optimize a slow API endpoint?', type: 'technical' },
      ],
    });

    callOllama.mockResolvedValueOnce('Welcome');
    await interviewer.startInterview();

    const intro = await interviewer.processIntroduction('I am Ethan.');
    expect(intro.message).toContain('Question 1/2');
    expect(intro.message).toContain('Tell me about a challenging bug you fixed.');

    callOllama.mockResolvedValueOnce('{"score":8,"action":"next_question","questionType":"technical","message":"Nice example."}');
    parseJSONResponse.mockReturnValueOnce({
      score: 8,
      action: 'next_question',
      questionType: 'technical',
      message: 'Nice example.',
    });

    const response = await interviewer.processAnswer('I debugged production logs and fixed a race condition.');
    expect(response.actionType).toBe('next_question');
    expect(response.questionNumber).toBe(2);
    expect(response.message).toContain('Question 2/2');
    expect(response.message).toContain('How would you optimize a slow API endpoint?');
  });

  it('forces next question when follow-up limit is reached', async () => {
    const interviewer = new AIInterviewer({
      totalQuestions: 2,
      maxFollowUpsPerQuestion: 1,
      questionBank: [
        { id: 'q1', question: 'Describe a conflict you resolved.', type: 'behavioral' },
        { id: 'q2', question: 'Explain REST idempotency with an example.', type: 'technical' },
      ],
    });

    callOllama.mockResolvedValueOnce('Welcome');
    await interviewer.startInterview();
    await interviewer.processIntroduction('Intro');

    callOllama.mockResolvedValueOnce('{"score":5,"action":"follow_up","questionType":"behavioral","message":"Can you be more specific?"}');
    parseJSONResponse.mockReturnValueOnce({
      score: 5,
      action: 'follow_up',
      questionType: 'behavioral',
      message: 'Can you be more specific?',
    });

    const first = await interviewer.processAnswer('I handled conflict.');
    expect(first.actionType).toBe('follow_up');
    expect(first.questionNumber).toBe(1);

    callOllama.mockResolvedValueOnce('{"score":5,"action":"follow_up","questionType":"behavioral","message":"Please add more detail."}');
    parseJSONResponse.mockReturnValueOnce({
      score: 5,
      action: 'follow_up',
      questionType: 'behavioral',
      message: 'Please add more detail.',
    });

    const second = await interviewer.processAnswer('I handled conflict.');
    expect(second.actionType).toBe('next_question');
    expect(second.questionNumber).toBe(2);
    expect(second.message).toContain('Question 2/2');
  });

  it('rewrites repeated follow-up wording instead of repeating the same prompt', async () => {
    const interviewer = new AIInterviewer({
      totalQuestions: 2,
      maxFollowUpsPerQuestion: 3,
      questionBank: [
        { id: 'q1', question: 'How did you communicate trade-offs?', type: 'behavioral' },
        { id: 'q2', question: 'How would you improve a flaky test suite?', type: 'technical' },
      ],
    });

    callOllama.mockResolvedValueOnce('Welcome');
    await interviewer.startInterview();
    await interviewer.processIntroduction('Intro');

    const repeatedFollowUp = 'Could you provide a specific example of how you communicated trade-offs to stakeholders?';

    callOllama.mockResolvedValueOnce('{"score":5,"action":"follow_up","questionType":"behavioral","message":"Could you provide a specific example of how you communicated trade-offs to stakeholders?"}');
    parseJSONResponse.mockReturnValueOnce({
      score: 5,
      action: 'follow_up',
      questionType: 'behavioral',
      message: repeatedFollowUp,
    });
    const first = await interviewer.processAnswer('I sent updates weekly.');
    expect(first.actionType).toBe('follow_up');
    expect(first.message).toBe(repeatedFollowUp);

    callOllama.mockResolvedValueOnce('{"score":5,"action":"follow_up","questionType":"behavioral","message":"Could you provide a specific example of how you communicated trade-offs to stakeholders?"}');
    parseJSONResponse.mockReturnValueOnce({
      score: 5,
      action: 'follow_up',
      questionType: 'behavioral',
      message: repeatedFollowUp,
    });
    const second = await interviewer.processAnswer('I posted a dashboard summary.');
    expect(second.actionType).toBe('follow_up');
    expect(second.message).not.toBe(repeatedFollowUp);
    expect(second.message.toLowerCase()).toContain('trade-offs');
  });

  it('does not allow model-generated primary question text when questionBank is active', async () => {
    const interviewer = new AIInterviewer({
      totalQuestions: 2,
      questionBank: [
        { id: 'q1', question: 'Tell me about a deadline you managed.', type: 'behavioral' },
        { id: 'q2', question: 'How do you design a resilient API?', type: 'technical' },
      ],
    });

    callOllama.mockResolvedValueOnce('Welcome');
    await interviewer.startInterview();
    await interviewer.processIntroduction('Intro');

    callOllama.mockResolvedValueOnce('{"score":8,"action":"next_question","questionType":"technical","message":"Great answer. Can you explain cloud cost optimization?"}');
    parseJSONResponse.mockReturnValueOnce({
      score: 8,
      action: 'next_question',
      questionType: 'technical',
      message: 'Great answer. Can you explain cloud cost optimization?',
    });

    const response = await interviewer.processAnswer('I handled the deadline with a plan and checkpoints.');
    expect(response.actionType).toBe('next_question');
    expect(response.message).toContain('How do you design a resilient API?');
    expect(response.message).not.toContain('cloud cost optimization');
  });

  it('falls back to the next planned question when the model stalls or fails', async () => {
    const interviewer = new AIInterviewer({
      totalQuestions: 2,
      questionBank: [
        { id: 'q1', question: 'Tell me about a production incident you handled.', type: 'behavioral' },
        { id: 'q2', question: 'How do you diagnose a slow database query?', type: 'technical' },
      ],
    });

    callOllama.mockResolvedValueOnce('Welcome');
    await interviewer.startInterview();
    await interviewer.processIntroduction('Intro');

    callOllama.mockRejectedValueOnce(new Error('Ollama request timed out after 20000ms'));

    const response = await interviewer.processAnswer('I coordinated rollback and customer updates.');
    expect(response.fallback).toBe(true);
    expect(response.actionType).toBe('next_question');
    expect(response.questionNumber).toBe(2);
    expect(response.message).toContain('How do you diagnose a slow database query?');
  });
});
